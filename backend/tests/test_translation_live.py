"""Opt-in integration with real local inference and an isolated temporary database.

LIVE_TRANSLATION_URL=http://127.0.0.1:8081 ../.venv/bin/pytest -q tests/test_translation_live.py
ASR is deliberately faked: this verifies transcript routing, not microphone/ASR quality.
"""
import os

import pytest
from fastapi.testclient import TestClient

from app.auth import COOKIE_NAME
from app.config import Settings
from app.main import create_app
from app.models import Message
from app.translation import LocalTranslator
from tests.conftest import Actor
from tests.fakes import FakeRecognizer

URL = os.environ.get("LIVE_TRANSLATION_URL")
pytestmark = pytest.mark.skipif(not URL, reason="Set LIVE_TRANSLATION_URL for real local inference")


def receive_final(socket):
    for _ in range(30):
        event = socket.receive_json()
        if event["type"] == "ping":
            socket.send_json({"type": "pong"})
        if event["type"] == "message.upsert" and event["message"]["status"] in {"translated", "error"}:
            return event["message"]
    raise AssertionError("No terminal message event")


def test_real_translation_text_transcript_persistence_and_retry(tmp_path):
    settings = Settings(
        _env_file=None, database_url=f"sqlite:///{tmp_path / 'live.db'}", speech_enabled=False,
        translation_backend="translategemma", translation_base_url=URL,
        translation_model="translategemma-4b-it", translation_api_key="",
        translation_concurrency=1, translation_timeout=45,
    )
    translator = LocalTranslator(settings)
    app = create_app(settings, recognizer=FakeRecognizer(), translator=translator)
    with TestClient(app) as client:
        response = client.post("/api/auth/register", json={
            "username": "localtester", "name": "Local Tester", "email": "localtester@example.com",
            "password": "integration-password", "password_confirmation": "integration-password",
        })
        assert response.status_code == 201
        owner = Actor(client, response.json(), client.cookies.get(COOKIE_NAME))
        room = owner.post("/api/rooms", json={"mode": "shared"}).json()["id"]
        with owner.socket(room) as socket:
            assert socket.receive_json()["type"] == "room.snapshot"
            response = owner.post(f"/api/rooms/{room}/messages", json={
                "text": "Xin chào, bạn có khỏe không?", "speaker": "A", "client_message_id": "live-text-001",
            })
            assert response.status_code == 201
            translated = receive_final(socket)
            assert translated["status"] == "translated", translated
            assert translated["translation"] and translated["source_language"] == "vi"
            with app.state.database.session() as db:
                persisted = db.get(Message, translated["sequence"])
                assert persisted.id == translated["id"]
                assert persisted.translation == translated["translation"]
            # This is the same submit path used by a finalized ASR transcript.
            client.portal.call(app.state.messages.submit, room, owner.user["id"],
                               "Thank you for your help.", "live-voice-001", "B", "voice")
            voice = receive_final(socket)
            assert voice["status"] == "translated", voice
            assert voice["source_language"] == "en" and voice["target_language"] == "vi"
            # Fail closed if the local model is unreachable, then retry the same message.
            settings.translation_base_url = "http://127.0.0.1:1"
            owner.post(f"/api/rooms/{room}/messages", json={
                "text": "Hẹn gặp lại.", "speaker": "A", "client_message_id": "live-retry-001",
            })
            failed = receive_final(socket)
            assert failed["status"] == "error" and failed["error_code"] == "unavailable"
            assert failed["translation"] is None and failed["text"] == "Hẹn gặp lại."
            settings.translation_base_url = URL
            assert owner.post(f"/api/rooms/{room}/messages/{failed['id']}/retry").status_code == 200
            retried = receive_final(socket)
            assert retried["id"] == failed["id"] and retried["status"] == "translated"
            assert retried["version"] > failed["version"]
