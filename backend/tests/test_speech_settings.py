from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from pydantic import ValidationError
from sqlalchemy import text

from app.db import Database
from app.schemas import SpeechSettingsPatch
from app.speech import AudioStream, Transcript
from app.speech_settings import SpeechSettingsStore, SpeechSnapshot
from tests.conftest import settings_for_test, wait_message
from tests.test_application import make_room
from tests.test_guest_join import anonymous_join, invitation

BASE = "/api/admin/settings/speech"
DEFAULTS = {"silence_ms": 1400, "max_segment_ms": 8000, "preview_ms": 1000, "revision": 0}


def test_speech_settings_authorization(system, actor):
    client, *_ = system
    normal = actor("normal")
    _, token = invitation(normal)
    guest, _ = anonymous_join(system, token)
    for method in ("get", "patch"):
        kwargs = {"json": {"revision": 0, "silence_ms": 1600}} if method == "patch" else {}
        response = getattr(client, method)(BASE, headers={"cookie": ""}, **kwargs)
        assert response.status_code == 401
        assert getattr(normal, method)(BASE, **kwargs).status_code == 403
        assert getattr(guest, method)(BASE, **kwargs).status_code == 403
    admin = actor("admin")
    assert admin.get(BASE).json() == DEFAULTS
    assert client.patch(BASE, json={"revision": 0, "silence_ms": 1600},
                        headers={**admin.headers, "origin": "https://untrusted.example"}).status_code == 403
    assert admin.get(BASE).json() == DEFAULTS


def test_speech_patch_is_atomic_partial_and_revision_guarded(actor):
    admin = actor("admin")
    result = admin.patch(BASE, json={"revision": 0, "silence_ms": 200, "preview_ms": 400})
    assert result.status_code == 200
    assert result.json() == {**DEFAULTS, "silence_ms": 200, "preview_ms": 400, "revision": 1}
    # Validate against persisted values, not the 1400/1000 defaults.
    result = admin.patch(BASE, json={"revision": 1, "max_segment_ms": 1000})
    assert result.status_code == 200
    saved = {"silence_ms": 200, "max_segment_ms": 1000, "preview_ms": 400, "revision": 2}
    assert result.json() == saved
    assert admin.patch(BASE, json={"revision": 1, "silence_ms": 800}).status_code == 409
    assert admin.patch(BASE, json={"revision": 2, "silence_ms": 1200,
                                   "preview_ms": 600}).status_code == 422
    assert admin.get(BASE).json() == saved
    assert admin.patch(BASE, json={"revision": 2, "silence_ms": 2000,
                                   "preview_ms": 5000, "max_segment_ms": 10000}).status_code == 200


@pytest.mark.parametrize("payload", [
    {"silence_ms": 199}, {"silence_ms": 2020}, {"silence_ms": 1410},
    {"max_segment_ms": 980}, {"max_segment_ms": 10020}, {"max_segment_ms": 8010},
    {"preview_ms": 380}, {"preview_ms": 5020}, {"preview_ms": 1010},
    {"max_segment_ms": 1000}, {"silence_ms": 2000, "max_segment_ms": 2000},
    {"silence_ms": None}, {"max_segment_ms": None}, {"preview_ms": None},
    {"silence_ms": True}, {"max_segment_ms": "8000"}, {"preview_ms": 1000.0},
    {"unknown": 1400}, {"revision": True}, {"revision": "0"}, {"revision": -1},
])
def test_invalid_speech_settings_never_change_saved_values(actor, payload):
    admin = actor("admin")
    assert admin.patch(BASE, json={"revision": 0, **payload}).status_code == 422
    assert admin.get(BASE).json() == DEFAULTS


def test_speech_patch_requires_revision(actor):
    assert actor("admin").patch(BASE, json={"silence_ms": 1600}).status_code == 422


def test_speech_seed_persistence_and_environment_precedence(tmp_path):
    settings = settings_for_test(database_url=f"sqlite:///{tmp_path / 'speech.db'}",
                                 speech_silence_ms=600, speech_max_segment_ms=4000,
                                 speech_preview_ms=800)
    database = Database(settings.database_url)
    database.migrate()
    store = SpeechSettingsStore(database, settings)
    store.initialize()
    assert store.snapshot() == SpeechSnapshot(silence_ms=600, max_segment_ms=4000, preview_ms=800)
    store.patch(SpeechSettingsPatch(revision=0, silence_ms=1600, max_segment_ms=8000))
    database.engine.dispose()
    database = Database(settings.database_url)
    # Saved configuration wins, even if the bootstrap environment combination is now invalid.
    settings.speech_silence_ms = 2000
    settings.speech_max_segment_ms = 1000
    store = SpeechSettingsStore(database, settings)
    store.initialize()
    snapshot = store.snapshot()
    assert snapshot == SpeechSnapshot(silence_ms=1600, max_segment_ms=8000, preview_ms=800, revision=1)
    with pytest.raises(ValidationError):
        snapshot.silence_ms = 400
    database.engine.dispose()


def test_invalid_initial_intervals_fail_without_inserting_row(tmp_path):
    settings = settings_for_test(database_url=f"sqlite:///{tmp_path / 'invalid.db'}",
                                 speech_silence_ms=1400, speech_max_segment_ms=1000)
    database = Database(settings.database_url)
    database.migrate()
    with pytest.raises(RuntimeError, match="Invalid initial speech"):
        SpeechSettingsStore(database, settings).initialize()
    with database.session() as db:
        assert db.execute(text("SELECT * FROM speech_settings")).all() == []
    database.engine.dispose()


def test_speech_migration_preserves_existing_settings_and_accounts(tmp_path):
    database = Database(f"sqlite:///{tmp_path / 'migration.db'}")
    root = Path(__file__).resolve().parent.parent
    config = Config(str(root / "alembic.ini"))
    config.set_main_option("script_location", str(root / "migrations"))
    with database.engine.begin() as conn:
        config.attributes["connection"] = conn
        command.upgrade(config, "0005")
        conn.execute(text("INSERT INTO translation_settings (id, base_url, model) "
                          "VALUES (1, 'https://gateway.example/v1', 'existing')"))
        conn.execute(text("INSERT INTO users (id, username, password_hash, created_at) "
                          "VALUES ('existing', 'admin', 'unchanged', '2026-01-01')"))
        users = conn.execute(text("SELECT * FROM users")).all()
        gateway = conn.execute(text("SELECT * FROM translation_settings")).all()
        command.upgrade(config, "head")
        assert conn.execute(text("SELECT * FROM speech_settings")).all() == []
        assert conn.execute(text("SELECT * FROM users")).all() == users
        assert conn.execute(text("SELECT * FROM translation_settings")).all() == gateway
        assert conn.execute(text("PRAGMA foreign_key_check")).all() == []
        command.downgrade(config, "0005")
        assert conn.execute(text("SELECT * FROM users")).all() == users
        assert conn.execute(text("SELECT * FROM translation_settings")).all() == gateway
    database.engine.dispose()


def test_default_capture_translates_both_halves_once_after_one_second_pause(system, actor, monkeypatch):
    from tests.test_speech import SILENCE, VOICE, MarkedVad

    _, _, translator, recognizer = system
    final_audio = []
    monkeypatch.setattr("app.speech.webrtcvad.Vad", lambda _: MarkedVad())

    async def recognize(pcm, language):
        final_audio.append(pcm)
        return Transcript("Tôi đồng ý nhưng chỉ khi giao trước thứ Sáu", "vi", 1)

    async def skip_preview(pcm, language):
        return None

    recognizer.transcribe = recognize
    recognizer.transcribe_preview = skip_preview
    owner = actor("alice")
    room_id = make_room(owner, mode="remote")
    with owner.socket(room_id) as socket:
        socket.receive_json()
        socket.send_json({"type": "audio.start", "capture_id": "paused-sentence"})
        assert socket.receive_json()["recording"] is True
        data = VOICE * 100 + SILENCE * 50 + VOICE * 100
        for start in range(0, len(data), 12800):
            socket.send_bytes(data[start:start + 12800])
        socket.send_json({"type": "audio.stop", "capture_id": "paused-sentence"})
        message = wait_message(owner, room_id, "translated")
        assert final_audio == [data]
        assert len(translator.calls) == 1
        assert translator.calls[0][0] == message["text"]
        assert len(owner.get(f"/api/rooms/{room_id}/messages").json()["messages"]) == 1


def test_admin_changes_apply_only_to_next_capture_on_same_websocket(system, actor, monkeypatch):
    streams = []

    class TrackedStream(AudioStream):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)
            streams.append(self)

    monkeypatch.setattr("app.main.AudioStream", TrackedStream)
    owner, admin = actor("alice"), actor("admin")
    room_id = make_room(owner, mode="remote")
    with owner.socket(room_id) as socket:
        assert socket.receive_json()["type"] == "room.snapshot"
        socket.send_json({"type": "audio.start", "capture_id": "first"})
        assert socket.receive_json() == {"type": "audio.state", "recording": True, "capture_id": "first"}
        first = streams[0].segmenter
        assert (first.silence_ms, first.max_ms, first.preview_ms) == (1400, 8000, 1000)
        response = admin.patch(BASE, json={"revision": 0, "silence_ms": 1800,
                                          "max_segment_ms": 10000, "preview_ms": 1200})
        assert response.status_code == 200
        assert (first.silence_ms, first.max_ms, first.preview_ms) == (1400, 8000, 1000)
        socket.send_json({"type": "audio.stop", "capture_id": "first"})
        assert socket.receive_json()["recording"] is False
        socket.send_json({"type": "audio.start", "capture_id": "second"})
        assert socket.receive_json() == {"type": "audio.state", "recording": True, "capture_id": "second"}
        second = streams[1].segmenter
        assert (second.silence_ms, second.max_ms, second.preview_ms) == (1800, 10000, 1200)
        assert (first.silence_ms, first.max_ms, first.preview_ms) == (1400, 8000, 1000)
        socket.send_json({"type": "audio.stop", "capture_id": "second"})
        assert socket.receive_json()["recording"] is False
