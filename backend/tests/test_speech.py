import asyncio
import threading
from types import SimpleNamespace

import pytest

from app.config import Settings
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


@pytest.mark.parametrize("mode", ["shared", "remote"])
@pytest.mark.parametrize("side", ["A", "B"])
@pytest.mark.parametrize(("language", "confidence"), [("en", .99), ("fi", .1), ("vi", .2), ("zh", .99)])
async def test_account_role_locks_preview_and_final_language(mode, side, language, confidence):
    recognizer = FakeRecognizer()
    text = "Xin chào" if side == "A" else "你好"
    recognizer.result = Transcript(text, language, confidence)
    sent, finals = [], []
    previewed = asyncio.Event()

    async def broadcast(room_id, payload):
        sent.append(payload)
        if payload["text"]:
            previewed.set()

    async def on_final(segment_id, text, speaker):
        finals.append((segment_id, text, speaker))

    connection = SimpleNamespace(side=side, user_id="test-user", send=lambda _: None)
    room = SimpleNamespace(id="room", mode=mode, language_a="vi", language_b="zh")
    stream = AudioStream(recognizer, connection, room, Settings(_env_file=None),
                         SimpleNamespace(broadcast=broadcast), on_final)
    try:
        stream.offer(AudioPiece("partial", "segment-1", VOICE * 50))
        await asyncio.wait_for(previewed.wait(), 1)
        stream.offer(AudioPiece("final", "segment-1", VOICE * 50))
    finally:
        await stream.stop(flush=False)
    assert finals == [("segment-1", text, side)]
    assert [call[1] for call in recognizer.calls] == ["vi" if side == "A" else "zh"] * 2
    assert sent[0]["speaker"] == side
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


@pytest.mark.parametrize("cancel_first", [False, True])
async def test_busy_cpu_drops_previews_and_keeps_final_inference_serial(monkeypatch, cancel_first):
    recognizer = WhisperRecognizer(Settings(_env_file=None))
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
