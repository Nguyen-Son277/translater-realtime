import math
import struct
import time

import pytest
from starlette.websockets import WebSocketDisconnect

from app.config import Settings
from app.main import create_app
from tests.conftest import wait_message
from tests.fakes import FakeRecognizer, FakeTranslator
from tests.test_application import join, make_room


def make_voice_frame():
    # 20ms of 440 Hz sine wave at 16000 Hz (320 samples, 640 bytes)
    samples = [int(16000 * math.sin(2 * math.pi * 440 * i / 16000)) for i in range(320)]
    return struct.pack(f"<{len(samples)}h", *samples)


def test_remote_presence_snapshot_and_broadcast(system, actor):
    owner, guest = actor("alice"), actor("bobby")
    room_id = make_room(owner, mode="remote")
    join(owner, guest, room_id)

    with owner.socket(room_id) as a:
        snapshot_a = a.receive_json()
        assert snapshot_a["type"] == "room.snapshot"
        assert snapshot_a["presence"] == [
            {"side": "A", "online": True, "recording": False},
            {"side": "B", "online": False, "recording": False},
        ]

        with guest.socket(room_id) as b:
            snapshot_b = b.receive_json()
            assert snapshot_b["type"] == "room.snapshot"
            assert snapshot_b["presence"] == [
                {"side": "A", "online": True, "recording": False},
                {"side": "B", "online": True, "recording": False},
            ]

            # Owner receives presence update that guest is now online
            presence_a = a.receive_json()
            assert presence_a == {
                "type": "room.presence",
                "members": [
                    {"side": "A", "online": True, "recording": False},
                    {"side": "B", "online": True, "recording": False},
                ],
            }


def test_capture_ab_simultaneous_in_remote_mode(system, actor):
    owner, guest = actor("alice"), actor("bobby")
    room_id = make_room(owner, mode="remote")
    join(owner, guest, room_id)

    with owner.socket(room_id) as a, guest.socket(room_id) as b:
        a.receive_json()
        b.receive_json()
        a.receive_json()  # presence of B joining

        # Owner starts capture
        a.send_json({"type": "audio.start", "capture_id": "cap-a"})
        assert a.receive_json() == {"type": "audio.state", "recording": True, "capture_id": "cap-a"}
        presence_b = b.receive_json()
        assert presence_b == {
            "type": "room.presence",
            "members": [
                {"side": "A", "online": True, "recording": True},
                {"side": "B", "online": True, "recording": False},
            ],
        }

        # Guest also starts capture simultaneously
        b.send_json({"type": "audio.start", "capture_id": "cap-b"})
        assert b.receive_json() == {"type": "audio.state", "recording": True, "capture_id": "cap-b"}
        presence_a = a.receive_json()
        assert presence_a == {
            "type": "room.presence",
            "members": [
                {"side": "A", "online": True, "recording": True},
                {"side": "B", "online": True, "recording": True},
            ],
        }

        # Both are recording simultaneously. Now owner stops.
        a.send_json({"type": "audio.stop", "capture_id": "cap-a"})
        assert a.receive_json() == {"type": "audio.state", "recording": False, "capture_id": "cap-a"}
        presence_b = b.receive_json()
        assert presence_b == {
            "type": "room.presence",
            "members": [
                {"side": "A", "online": True, "recording": False},
                {"side": "B", "online": True, "recording": True},
            ],
        }

        # Guest stops
        b.send_json({"type": "audio.stop", "capture_id": "cap-b"})
        assert b.receive_json() == {"type": "audio.state", "recording": False, "capture_id": "cap-b"}
        presence_a = a.receive_json()
        assert presence_a == {
            "type": "room.presence",
            "members": [
                {"side": "A", "online": True, "recording": False},
                {"side": "B", "online": True, "recording": False},
            ],
        }


def test_duplicate_side_capture_rejected(system, actor):
    owner = actor("alice")
    room_id = make_room(owner, mode="remote")

    with owner.socket(room_id) as tab1, owner.socket(room_id) as tab2:
        tab1.receive_json()
        tab2.receive_json()

        tab1.send_json({"type": "audio.start", "capture_id": "tab1-cap"})
        assert tab1.receive_json() == {"type": "audio.state", "recording": True, "capture_id": "tab1-cap"}
        assert tab2.receive_json()["type"] == "room.presence"

        # Tab 2 tries to capture same side A -> rejected with capture_in_use and echoes capture_id
        tab2.send_json({"type": "audio.start", "capture_id": "tab2-cap"})
        err = tab2.receive_json()
        assert err["type"] == "error"
        assert err["code"] == "capture_in_use"
        assert err["capture_id"] == "tab2-cap"

        # Tab 1 is still recording and can stop
        tab1.send_json({"type": "audio.stop", "capture_id": "tab1-cap"})
        assert tab1.receive_json() == {"type": "audio.state", "recording": False, "capture_id": "tab1-cap"}


@pytest.mark.parametrize("capture_id", ["", "x" * 129, 3, {}, []])
def test_invalid_capture_id_rejected_without_acquiring_microphone(system, actor, capture_id):
    owner = actor("alice")
    room_id = make_room(owner, mode="remote")
    with owner.socket(room_id) as socket:
        socket.receive_json()
        socket.send_json({"type": "audio.start", "capture_id": capture_id})
        assert socket.receive_json()["code"] == "invalid_event"
        socket.send_json({"type": "audio.start", "capture_id": "valid"})
        assert socket.receive_json()["recording"] is True
        socket.send_json({"type": "audio.stop", "capture_id": "valid"})
        assert socket.receive_json()["recording"] is False


def test_another_start_id_cannot_replace_active_stream(system, actor):
    owner = actor("alice")
    room_id = make_room(owner, mode="remote")
    with owner.socket(room_id) as socket:
        socket.receive_json()
        socket.send_json({"type": "audio.start", "capture_id": "active"})
        assert socket.receive_json()["recording"] is True
        socket.send_json({"type": "audio.start", "capture_id": "different"})
        rejected = socket.receive_json()
        assert rejected["code"] == "capture_busy"
        assert rejected["capture_id"] == "different"
        socket.send_json({"type": "audio.start", "capture_id": "active"})
        assert socket.receive_json() == {"type": "audio.state", "recording": True, "capture_id": "active"}
        socket.send_json({"type": "audio.stop", "capture_id": "active"})
        assert socket.receive_json()["recording"] is False


def test_stale_stop_event_ignored_and_cannot_stop_new_capture(system, actor):
    owner = actor("alice")
    room_id = make_room(owner, mode="shared")

    with owner.socket(room_id) as socket:
        socket.receive_json()

        # Start capture with cap-new
        socket.send_json({"type": "audio.start", "capture_id": "cap-new"})
        assert socket.receive_json() == {"type": "audio.state", "recording": True, "capture_id": "cap-new"}

        # Stale stop with cap-old must NOT stop the new capture
        socket.send_json({"type": "audio.stop", "capture_id": "cap-old"})

        # Capture is still active: sending another audio.start returns recording: True
        socket.send_json({"type": "audio.start", "capture_id": "cap-new"})
        assert socket.receive_json() == {"type": "audio.state", "recording": True, "capture_id": "cap-new"}

        # Stopping with matching capture_id stops properly
        socket.send_json({"type": "audio.stop", "capture_id": "cap-new"})
        assert socket.receive_json() == {"type": "audio.state", "recording": False, "capture_id": "cap-new"}

        # Starting without capture_id (legacy)
        socket.send_json({"type": "audio.start"})
        assert socket.receive_json() == {"type": "audio.state", "recording": True}

        # Stopping without capture_id (legacy)
        socket.send_json({"type": "audio.stop"})
        assert socket.receive_json() == {"type": "audio.state", "recording": False}


def test_disconnect_releases_capture_and_cleans_up(system, actor):
    owner, guest = actor("alice"), actor("bobby")
    room_id = make_room(owner, mode="remote")
    join(owner, guest, room_id)

    with guest.socket(room_id) as b:
        b.receive_json()

        with owner.socket(room_id) as a:
            a.receive_json()
            b.receive_json()  # presence of A joining

            a.send_json({"type": "audio.start", "capture_id": "cap-disconnect"})
            assert a.receive_json() == {"type": "audio.state", "recording": True, "capture_id": "cap-disconnect"}
            assert b.receive_json()["members"][0]["recording"] is True

        # Owner socket disconnects. Guest receives presence update
        presence = b.receive_json()
        assert presence["type"] == "room.presence"
        assert presence["members"][0] == {"side": "A", "online": False, "recording": False}

        # Owner reconnects and can immediately start capture without conflict
        with owner.socket(room_id) as a2:
            a2.receive_json()
            b.receive_json()  # presence of A online
            a2.send_json({"type": "audio.start", "capture_id": "cap-fresh"})
            assert a2.receive_json() == {"type": "audio.state", "recording": True, "capture_id": "cap-fresh"}


def test_binary_pcm_streaming_with_fake_recognizer(system, actor):
    _, _, translator, recognizer = system
    owner = actor("alice")
    room_id = make_room(owner, mode="shared")

    with owner.socket(room_id) as socket:
        socket.receive_json()

        socket.send_json({"type": "audio.start", "capture_id": "pcm-stream"})
        assert socket.receive_json() == {"type": "audio.state", "recording": True, "capture_id": "pcm-stream"}

        voice_frame = make_voice_frame()
        silence_frame = b"\x00" * 640

        # Send 15 voiced frames (300 ms) + 25 silence frames (500 ms)
        for _ in range(15):
            socket.send_bytes(voice_frame)
        for _ in range(25):
            socket.send_bytes(silence_frame)

        # Stop audio - ack returns promptly
        socket.send_json({"type": "audio.stop", "capture_id": "pcm-stream"})
        assert socket.receive_json() == {"type": "audio.state", "recording": False, "capture_id": "pcm-stream"}

        # Wait for the drained final audio to be transcribed and translated
        message = wait_message(owner, room_id, "translated")
        assert message["text"] == "Xin chào"
        assert message["translation"] == "Hello"
        assert message["source"] == "voice"


def test_two_remote_binary_streams_keep_authors_languages_and_history_distinct(system, actor):
    from app.speech import Transcript

    _, _, _, recognizer = system

    async def recognize(pcm, language):
        recognizer.calls.append((len(pcm), language))
        return Transcript("Xin chào" if language == "vi" else "Hello", language, 1)

    recognizer.transcribe = recognize
    owner, guest = actor("alice"), actor("bobby")
    room_id = make_room(owner, mode="remote")
    join(owner, guest, room_id)

    def audio_state(socket, recording):
        for _ in range(30):
            payload = socket.receive_json()
            if payload["type"] == "ping":
                socket.send_json({"type": "pong"})
            if payload["type"] == "audio.state":
                assert payload["recording"] is recording
                return
        raise AssertionError("No capture acknowledgement")

    with owner.socket(room_id) as a, guest.socket(room_id) as b:
        a.receive_json()
        b.receive_json()
        a.send_json({"type": "audio.start", "capture_id": "a"})
        b.send_json({"type": "audio.start", "capture_id": "b"})
        audio_state(a, True)
        audio_state(b, True)
        for frame in [make_voice_frame()] * 15 + [b"\x00" * 640] * 25:
            a.send_bytes(frame)
            b.send_bytes(frame)
        a.send_json({"type": "audio.stop", "capture_id": "a"})
        b.send_json({"type": "audio.stop", "capture_id": "b"})
        audio_state(a, False)
        audio_state(b, False)
        wait_message(owner, room_id, "translated", count=2)
        messages = owner.get(f"/api/rooms/{room_id}/messages").json()["messages"]
        assert messages == guest.get(f"/api/rooms/{room_id}/messages").json()["messages"]
        assert len(messages) == 2
        assert {(m["speaker"], m["source_language"], m["target_language"], m["text"], m["translation"]) for m in messages} == {
            ("A", "vi", "en", "Xin chào", "Hello"),
            ("B", "en", "vi", "Hello", "Xin chào"),
        }
        assert {m["source"] for m in messages} == {"voice"}
        assert {language for _, language in recognizer.calls} == {"vi", "en"}


def test_ping_pong_deadline_and_no_audio_substitution(tmp_path):
    from fastapi.testclient import TestClient
    settings = Settings(
        _env_file=None,
        database_url=f"sqlite:///{tmp_path / 'ping_test.db'}",
        whisper_download_root=str(tmp_path / "models"),
        ws_ping_interval=0.05,
        ws_pong_deadline=0.15,
    )
    app = create_app(settings, recognizer=FakeRecognizer(), translator=FakeTranslator())
    with TestClient(app) as client:
        # Register on this test client
        client.post("/api/auth/register", json={
            "username": "tester", "name": "Tester", "email": "tester@example.com",
            "password": "correct-password", "password_confirmation": "correct-password",
        })
        room_resp = client.post("/api/rooms", json={"mode": "shared", "title": "Ping Room"})
        room_id = room_resp.json()["id"]

        # Case 1: Client replies pong to ping -> stays connected
        with client.websocket_connect(f"/ws/rooms/{room_id}") as socket:
            socket.receive_json()  # snapshot
            ping_msg = socket.receive_json()
            assert ping_msg["type"] == "ping"
            socket.send_json({"type": "pong"})
            # Another ping arrives next interval
            ping_msg2 = socket.receive_json()
            assert ping_msg2["type"] == "ping"
            socket.send_json({"type": "pong"})

        # Case 2: Client does NOT send pong, but sends continuous binary audio traffic.
        # Audio traffic must NOT substitute for pong; deadline expires and connection closes.
        with client.websocket_connect(f"/ws/rooms/{room_id}") as socket:
            socket.receive_json()  # snapshot
            socket.send_json({"type": "audio.start"})
            assert socket.receive_json()["recording"] is True

            for _ in range(30):
                try:
                    socket.send_bytes(b"\x00" * 640)
                except Exception:
                    break
                time.sleep(0.01)

            with pytest.raises(WebSocketDisconnect) as closed:
                while True:
                    socket.receive_json()
            assert closed.value.code == 1000
