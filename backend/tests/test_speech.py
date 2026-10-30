import asyncio
import threading
from types import SimpleNamespace

import pytest

from app.config import Settings
from app.nemotron import NemotronRecognizer
from app.speech import AudioPiece, AudioSegmenter, AudioStream, Transcript, WhisperRecognizer
from tests.fakes import FakeRecognizer

VOICE = b"\x01\x00" * 320
SILENCE = b"\x00\x00" * 320


class MarkedVad:
    def is_speech(self, frame, sample_rate):
        assert len(frame) == 640 and sample_rate == 16000
        return frame[0] == 1


def test_silence_creates_no_utterance_and_short_noise_is_ignored():
    vad = AudioSegmenter(vad=MarkedVad())
    assert vad.feed(SILENCE * 500) == []
    assert vad.feed(VOICE * 2 + SILENCE * 30) == []
    assert vad.flush() == []


def test_vad_handles_packet_boundaries_and_closes_after_400ms():
    segmenter = AudioSegmenter(vad=MarkedVad())
    data = VOICE * 50 + SILENCE * 20
    pieces = []
    for start in range(0, len(data), 731):
        pieces.extend(segmenter.feed(data[start:start + 731]))
    finals = [piece for piece in pieces if piece.kind == "final"]
    assert len(finals) == 1
    assert finals[0].pcm == data
    assert segmenter.flush() == []


def test_long_speech_gets_previews_and_bounded_four_second_segments():
    segmenter = AudioSegmenter(vad=MarkedVad())
    pieces = segmenter.feed(VOICE * 650) + segmenter.flush()
    finals = [piece for piece in pieces if piece.kind == "final"]
    assert len(finals) == 4
    assert all(len(piece.pcm) <= 16000 * 2 * 4 for piece in finals)
    assert sum(len(piece.pcm) for piece in finals) == len(VOICE) * 650
    assert any(piece.kind == "partial" for piece in pieces)
    assert len({piece.segment_id for piece in finals}) == 4


def test_silence_does_not_start_another_preview_while_waiting_to_finalize():
    segmenter = AudioSegmenter(vad=MarkedVad())
    pieces = segmenter.feed(VOICE * 45 + SILENCE * 20)
    assert [piece.kind for piece in pieces] == ["final"]


@pytest.mark.parametrize(("mode", "language", "confidence", "expected"), [
    ("shared", "vi", .99, "A"), ("shared", "en", .99, "B"),
    ("shared", "en", .3, None), ("shared", "fr", .99, None),
    ("remote", "vi", .2, "B"),
])
async def test_speaker_assignment_and_final_transcription(mode, language, confidence, expected):
    recognizer = FakeRecognizer()
    recognizer.result = Transcript("Xin chào", language, confidence)
    sent, finals = [], []

    async def broadcast(room_id, payload):
        sent.append(payload)

    async def on_final(segment_id, text, speaker):
        finals.append((segment_id, text, speaker))

    connection = SimpleNamespace(side="B", user_id="test-user", send=lambda _: None)
    room = SimpleNamespace(id="room", mode=mode, language_a="vi", language_b="en")
    stream = AudioStream(recognizer, connection, room, Settings(_env_file=None),
                         SimpleNamespace(broadcast=broadcast), on_final)
    stream.offer(AudioPiece("final", "segment-1", VOICE * 50))
    await stream.stop(flush=False)
    assert finals == [("segment-1", "Xin chào", expected)]
    expected_language = "en" if mode == "remote" else ("vi", "en")
    assert recognizer.calls[0][1] == expected_language
    assert sent[-1]["text"] == ""


async def test_audio_queue_is_bounded():
    recognizer = FakeRecognizer()
    stream = AudioStream(recognizer, SimpleNamespace(side="A", user_id="user"),
                         SimpleNamespace(id="room", mode="shared", language_a="vi", language_b="en"),
                         Settings(_env_file=None, audio_queue_size=1), None, None)
    stream.offer(AudioPiece("final", "one", VOICE))
    with pytest.raises(OverflowError):
        stream.offer(AudioPiece("final", "two", VOICE))
    stream.worker.cancel()
    await asyncio.gather(stream.worker, return_exceptions=True)


async def test_busy_capture_discards_preview_backlog_but_preserves_finals():
    started, release = asyncio.Event(), asyncio.Event()
    recognizer = FakeRecognizer()
    original_preview = recognizer.transcribe_preview

    async def slow_preview(pcm, language):
        started.set()
        await release.wait()
        return await original_preview(pcm, language)

    recognizer.transcribe_preview = slow_preview
    sent, finals = [], []

    async def broadcast(room_id, payload):
        sent.append(payload)

    async def on_final(segment_id, text, speaker):
        finals.append(segment_id)

    stream = AudioStream(
        recognizer, SimpleNamespace(side="A", user_id="user"),
        SimpleNamespace(id="room", mode="shared", language_a="vi", language_b="en"),
        Settings(_env_file=None), SimpleNamespace(broadcast=broadcast), on_final,
    )
    try:
        stream.offer(AudioPiece("partial", "first", VOICE * 50))
        await asyncio.wait_for(started.wait(), 1)
        stream.offer(AudioPiece("partial", "second", VOICE * 50))
        assert stream.partial is None
        stream.offer(AudioPiece("final", "first", VOICE * 50))
        assert len(stream.finals) == 1
    finally:
        release.set()
        await stream.stop(flush=False)
    assert finals == ["first"]
    assert len(recognizer.calls) == 2
    assert all(not payload["text"] for payload in sent)


@pytest.mark.parametrize("recognizer_class", [WhisperRecognizer, NemotronRecognizer])
@pytest.mark.parametrize("cancel_first", [False, True])
async def test_busy_cpu_drops_previews_and_keeps_final_inference_serial(
    monkeypatch, cancel_first, recognizer_class,
):
    recognizer = recognizer_class(Settings(_env_file=None))
    recognizer.state = "ready"
    started, release = asyncio.Event(), threading.Event()
    loop = asyncio.get_running_loop()
    calls = []

    def recognize(pcm, language):
        calls.append(pcm)
        if pcm == b"first final":
            loop.call_soon_threadsafe(started.set)
            assert release.wait(3), "test did not release the CPU"
        return Transcript(pcm.decode(), language or "vi", 1)

    monkeypatch.setattr(recognizer, "transcribe_sync", recognize)
    first = asyncio.create_task(recognizer.transcribe(b"first final", "vi"))
    try:
        await asyncio.wait_for(started.wait(), 1)
        if cancel_first:
            first.cancel()
            await asyncio.sleep(0)
        assert await asyncio.wait_for(
            recognizer.transcribe_preview(b"stale preview", "en"), .2,
        ) is None
        second = asyncio.create_task(recognizer.transcribe(b"second final", "en"))
        await asyncio.sleep(0)
        assert calls == [b"first final"]
    finally:
        release.set()
    if cancel_first:
        with pytest.raises(asyncio.CancelledError):
            await first
    else:
        assert (await first).text == "first final"
    assert (await second).text == "second final"
    assert calls == [b"first final", b"second final"]
    assert (await recognizer.transcribe_preview(b"fresh preview", "vi")).text == "fresh preview"


def test_whisper_restricts_shared_room_detection_to_selected_languages():
    class Segment:
        text = "Xin chào"

    class Model:
        def __init__(self):
            self.detected = []
            self.transcribed = []

        def detect_language(self, audio, language_detection_segments):
            self.detected.append((audio, language_detection_segments))
            return "ja", .91, [("ja", .91), ("zh", .04), ("vi", .03), ("en", .02)]

        def transcribe(self, audio, **kwargs):
            self.transcribed.append((audio, kwargs))
            return iter([Segment()]), type("Info", (), {
                "language": kwargs["language"], "language_probability": 1.0,
            })()

    recognizer = WhisperRecognizer(Settings(_env_file=None))
    recognizer.model = Model()
    result = recognizer.transcribe_sync(b"\x01\x00" * 320, ("vi", "zh"))
    assert result.text == "Xin chào"
    assert result.language == "zh"
    assert result.confidence == .04
    assert recognizer.model.transcribed[0][1]["language"] == "zh"
