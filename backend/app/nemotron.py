"""Nemotron RNNT adapter for the app's bounded PCM utterances and previews.

This uses segment inference, not persistent cache-aware streaming. Each call is
independent so encoder state cannot leak between rooms or microphone captures.
"""
import re

import numpy as np

from app.speech import SpeechRecognizer, Transcript

# Explicit locales keep app language codes independent of tokenizer defaults.
LOCALES = {
    "vi": "vi-VN", "en": "en-US", "ja": "ja-JP", "ko": "ko-KR",
    "zh": "zh-CN", "fr": "fr-FR", "de": "de-DE", "es": "es-ES",
}
LANGUAGE_TAG = re.compile(r"<([a-z]{2,3})-[A-Z]{2}>")


class NemotronRecognizer(SpeechRecognizer):
    def __init__(self, settings):
        super().__init__(settings)
        self.processor = None

    def load_sync(self):
        import torch
        from transformers import AutoModelForRNNT, AutoProcessor

        torch.set_num_threads(self.settings.speech_cpu_threads)
        options = {"cache_dir": self.settings.speech_download_root}
        self.processor = AutoProcessor.from_pretrained(self.settings.speech_model, **options)
        if self.processor.feature_extractor.sampling_rate != 16000:
            raise ValueError("Speech model must accept 16 kHz audio")
        model = AutoModelForRNNT.from_pretrained(self.settings.speech_model, **options)
        model.to(self.settings.speech_device)
        model.eval()
        return model

    def transcribe_sync(self, pcm: bytes, language: str | tuple[str, ...] | None) -> Transcript:
        import torch

        allowed = tuple(dict.fromkeys(language)) if isinstance(language, (tuple, list)) else ()
        if isinstance(language, (tuple, list)):
            language = allowed[0] if len(allowed) == 1 else None
        if language == "auto":
            language = None
        if language is not None and language not in LOCALES:
            raise ValueError(f"Unsupported speech language: {language}")
        if len(pcm) % 2:
            raise ValueError("PCM must contain complete 16-bit samples")
        if not pcm:
            return Transcript("", language or "", 0.0)

        audio = np.frombuffer(pcm, dtype="<i2").astype(np.float32) / 32768.0
        inputs = self.processor(
            audio, sampling_rate=16000, language=LOCALES.get(language, "auto"),
            return_tensors="pt",
        )
        inputs = inputs.to(self.model.device, dtype=self.model.dtype)
        with torch.inference_mode():
            output = self.model.generate(**inputs, return_dict_in_generate=True, max_new_tokens=512)
        raw = self.processor.batch_decode(output.sequences, skip_special_tokens=False)[0]
        text = self.processor.batch_decode(output.sequences, skip_special_tokens=True)[0].strip()
        # Defensive removal if a tokenizer does not mark language tags as special.
        text = LANGUAGE_TAG.sub("", text).strip()
        tags = LANGUAGE_TAG.findall(raw)
        detected = language or (tags[-1] if tags else "")
        # RNNT does not expose Whisper's language posterior. This is a routing
        # indicator, NOT a calibrated probability: unknown/out-of-room tags must
        # leave shared-room speaker selection to the user, never guess a side.
        accepted = detected in LOCALES and (not allowed or detected in allowed)
        return Transcript(text[:4000], detected, 1.0 if accepted else 0.0)
