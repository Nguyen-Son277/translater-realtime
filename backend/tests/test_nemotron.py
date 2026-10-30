import asyncio
import sys
from contextlib import nullcontext
from types import SimpleNamespace

import numpy as np
import pytest
from pydantic import ValidationError

from app.config import LANGUAGES, Settings
from app.nemotron import LOCALES, NemotronRecognizer
from app.speech import WhisperRecognizer, create_recognizer


def test_default_backend_and_explicit_whisper_fallback():
    settings = Settings(_env_file=None)
    assert isinstance(create_recognizer(settings), NemotronRecognizer)
    assert settings.speech_model == "nvidia/nemotron-3.5-asr-streaming-0.6b"
    assert set(LANGUAGES) <= set(LOCALES)
    assert isinstance(create_recognizer(Settings(_env_file=None, speech_backend="whisper")),
                      WhisperRecognizer)
    with pytest.raises(ValidationError):
        Settings(_env_file=None, speech_backend="typo")


@pytest.fixture
def recognizer(monkeypatch):
    monkeypatch.setitem(sys.modules, "torch", SimpleNamespace(inference_mode=nullcontext))

    class Inputs(dict):
        def to(self, device, dtype):
            assert (device, dtype) == ("cpu", "float32")
            return self

    class Processor:
        raw = "Xin chào.<vi-VN>"
        clean = "Xin chào."

        def __call__(self, audio, **kwargs):
            self.audio, self.kwargs = audio, kwargs
            return Inputs(input_features="features")

        def batch_decode(self, sequences, skip_special_tokens):
            assert sequences == "sequences"
            return [self.clean if skip_special_tokens else self.raw]

    def generate(**kwargs):
        assert kwargs == {"input_features": "features", "return_dict_in_generate": True,
                          "max_new_tokens": 512}
        return SimpleNamespace(sequences="sequences")

    result = NemotronRecognizer(Settings(_env_file=None))
    result.processor = Processor()
    result.model = SimpleNamespace(device="cpu", dtype="float32", generate=generate)
    return result


@pytest.mark.parametrize("language", ["vi", ("vi",), ("vi", "vi")])
def test_known_language_prompt_and_pcm_normalization(recognizer, language):
    result = recognizer.transcribe_sync(b"\x00\x80\xff\x7f", language)
    assert result.text == "Xin chào."
    assert (result.language, result.confidence) == ("vi", 1.0)
    assert recognizer.processor.kwargs == {
        "sampling_rate": 16000, "language": "vi-VN", "return_tensors": "pt",
    }
    assert recognizer.processor.audio.dtype == np.float32
    np.testing.assert_allclose(recognizer.processor.audio, [-1, 32767 / 32768])


@pytest.mark.parametrize("language", [("vi", "en"), None, "auto", ()])
def test_auto_language_tag_is_used_and_removed(recognizer, language):
    result = recognizer.transcribe_sync(b"\x00\x00" * 320, language)
    assert recognizer.processor.kwargs["language"] == "auto"
    assert result.text == "Xin chào."
    assert (result.language, result.confidence) == ("vi", 1.0)


@pytest.mark.parametrize(("raw", "expected"), [
    ("Bonjour.<fr-FR>", "fr"), ("Hello.", ""), ("Speech.<xx-XX>", "xx"),
])
def test_unrecognized_or_out_of_room_tag_does_not_guess_a_speaker(recognizer, raw, expected):
    recognizer.processor.raw = raw
    result = recognizer.transcribe_sync(b"\x00\x00" * 320, ("vi", "en"))
    assert result.language == expected
    assert result.confidence == 0.0


def test_output_is_bounded_and_language_tags_are_not_shown(recognizer):
    recognizer.processor.clean = "x" * 4500 + "<vi-VN>"
    result = recognizer.transcribe_sync(b"\x00\x00" * 320, None)
    assert result.text == "x" * 4000


def test_empty_and_malformed_audio(recognizer):
    assert recognizer.transcribe_sync(b"", "vi").text == ""
    with pytest.raises(ValueError, match="16-bit"):
        recognizer.transcribe_sync(b"\x00", "vi")
    with pytest.raises(ValueError, match="Unsupported"):
        recognizer.transcribe_sync(b"\x00\x00", "xx")


def test_loader_selects_model_cache_device_and_eval(monkeypatch):
    calls = []
    model = SimpleNamespace(to=lambda device: calls.append(("device", device)),
                            eval=lambda: calls.append(("eval",)))
    processor = SimpleNamespace(feature_extractor=SimpleNamespace(sampling_rate=16000))

    def load_processor(name, **kwargs):
        calls.append(("processor", name, kwargs))
        return processor

    def load_model(name, **kwargs):
        calls.append(("model", name, kwargs))
        return model

    monkeypatch.setitem(sys.modules, "torch", SimpleNamespace(
        set_num_threads=lambda n: calls.append(("threads", n))))
    monkeypatch.setitem(sys.modules, "transformers", SimpleNamespace(
        AutoProcessor=SimpleNamespace(from_pretrained=load_processor),
        AutoModelForRNNT=SimpleNamespace(from_pretrained=load_model),
    ))
    settings = Settings(_env_file=None, speech_download_root="/tmp/test-models", speech_device="cuda")
    recognizer = NemotronRecognizer(settings)
    assert recognizer.load_sync() is model
    assert recognizer.processor is processor
    assert calls == [
        ("threads", 4),
        ("processor", settings.speech_model, {"cache_dir": "/tmp/test-models"}),
        ("model", settings.speech_model, {"cache_dir": "/tmp/test-models"}),
        ("device", "cuda"), ("eval",),
    ]


async def test_disabled_backend_does_not_load_model(monkeypatch):
    recognizer = NemotronRecognizer(Settings(_env_file=None, speech_enabled=False))
    monkeypatch.setattr(recognizer, "load_sync", lambda: pytest.fail("disabled model loaded"))
    await recognizer.start()
    await recognizer.close()
    assert recognizer.state == "disabled"
    assert recognizer.initializing is None


async def test_failed_load_is_not_ready(monkeypatch):
    recognizer = NemotronRecognizer(Settings(_env_file=None))

    def fail():
        raise RuntimeError("model unavailable")

    monkeypatch.setattr(recognizer, "load_sync", fail)
    await recognizer.start()
    await recognizer.close()
    assert recognizer.state == "error"
    with pytest.raises(RuntimeError, match="speech_unavailable"):
        await recognizer.transcribe(b"\x00\x00", "vi")


async def test_ready_only_after_warmup(monkeypatch):
    recognizer = NemotronRecognizer(Settings(_env_file=None))
    warmed = []
    monkeypatch.setattr(recognizer, "load_sync", object)
    monkeypatch.setattr(recognizer, "transcribe_sync", lambda pcm, lang: warmed.append((pcm, lang)))
    await recognizer.start()
    await recognizer.close()
    assert recognizer.state == "ready"
    assert warmed == [(b"\x00" * 32000, "en")]
    async with recognizer.semaphore:
        assert await asyncio.wait_for(recognizer.transcribe_preview(b"", "vi"), .2) is None
