import asyncio
from types import SimpleNamespace

import pytest

from app.config import Settings
from app.hub import Connection, Hub
from app.speech import AudioPiece, AudioStream, Transcript
from tests.fakes import FakeRecognizer


class Socket:
    def __init__(self):
        self.events = []

    async def send_json(self, payload):
        self.events.append(payload)

    async def close(self, code=1000):
        pass


def connection(side="A"):
    return Connection(Socket(), f"user-{side}", "room", side, "session")


def room():
    return SimpleNamespace(id="room", mode="remote", language_a="vi", language_b="en")


async def test_stopped_streams_are_bounded_across_reconnects_and_drain_once():
    hub = Hub()
    a, b = connection(), connection("B")
    hub.add(a)
    hub.add(b)
    release = asyncio.Event()
    recognizer = FakeRecognizer()
    finals = []

    async def transcribe(pcm, language):
        await release.wait()
        return Transcript(pcm.decode(), language, 1)

    async def final(segment_id, text, speaker):
        finals.append((segment_id, text, speaker))

    recognizer.transcribe = transcribe
    streams = []
    for index in range(2):
        assert hub.can_start_capture(a, "remote")
        assert hub.acquire_capture(a, "remote", str(index))
        stream = AudioStream(recognizer, a, room(), Settings(_env_file=None), hub, final, str(index))
        streams.append(stream)
        stream.offer(AudioPiece("final", str(index), f"sentence-{index}".encode()))
        hub.drain_capture(a, "remote", stream, flush=False)
        hub.release_capture(a, str(index))
    reconnected_a = connection()
    assert not hub.can_start_capture(a, "remote")
    assert not hub.can_start_capture(reconnected_a, "remote")
    assert hub.can_start_capture(b, "remote")
    assert not hub.presence("room")[0]["recording"]
    release.set()
    await asyncio.wait_for(hub.close_drains(), 1)
    assert sorted(finals) == [("0", "sentence-0", "A"), ("1", "sentence-1", "A")]
    assert all(stream.worker.done() and stream.cleanup_task.done() for stream in streams)
    assert hub.can_start_capture(reconnected_a, "remote")
    assert not hub.drains


async def test_drain_timeout_cancels_worker_cleans_previews_and_reports_missing_audio(monkeypatch):
    monkeypatch.setattr("app.speech.DRAIN_TIMEOUT", .01)
    hub = Hub()
    a = connection()
    hub.add(a)
    started = asyncio.Event()
    recognizer = FakeRecognizer()
    finals = []

    async def transcribe(pcm, language):
        started.set()
        await asyncio.Event().wait()

    async def final(*args):
        finals.append(args)

    recognizer.transcribe = transcribe
    stream = AudioStream(recognizer, a, room(), Settings(_env_file=None), hub, final, "old-id")
    await stream.preview("old-segment", "pending", "A")
    stream.offer(AudioPiece("final", "old-segment", b"audio"))
    await asyncio.wait_for(started.wait(), 1)
    hub.drain_capture(a, "remote", stream, flush=False)
    await asyncio.wait_for(hub.close_drains(), 1)
    assert stream.worker.cancelled()
    assert not stream.preview_ids
    assert not finals
    assert any(event.get("code") == "speech_drain_timeout" and event["capture_id"] == "old-id" for event in a.websocket.events)
    assert any(event.get("segment_id") == "old-segment" and event["text"] == "" for event in a.websocket.events)


async def test_slow_downlink_cannot_hold_broadcast_and_capture_lease_forever(monkeypatch):
    monkeypatch.setattr("app.hub.SEND_TIMEOUT", .01)
    hub = Hub()
    a, b = connection(), connection("B")

    async def blocked_send(payload):
        await asyncio.Event().wait()

    a.websocket.send_json = blocked_send
    hub.add(a)
    hub.add(b)
    hub.acquire_capture(a, "remote", "capture")
    await asyncio.wait_for(hub.broadcast("room", {"type": "ping"}), 1)
    assert a not in hub.rooms["room"]
    assert not hub.captures
    assert b.websocket.events[-1] == {"type": "room.presence", "members": [
        {"side": "A", "online": False, "recording": False},
        {"side": "B", "online": True, "recording": False},
    ]}
    # Timeout also applies while waiting to acquire a connection's send lock.
    async with b.lock:
        with pytest.raises(TimeoutError):
            await b.send({"type": "ping"})
