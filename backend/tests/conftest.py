import time

import pytest
from fastapi.testclient import TestClient

from app.auth import COOKIE_NAME
from app.config import Settings
from app.main import create_app
from tests.fakes import FakeRecognizer, FakeTranslator


class Actor:
    def __init__(self, client, user, token):
        self.client, self.user, self.token = client, user, token

    @property
    def headers(self):
        return {"cookie": f"{COOKIE_NAME}={self.token}", "origin": "http://testserver"}

    def get(self, path, **kwargs):
        return self.client.get(path, headers=self.headers, **kwargs)

    def post(self, path, **kwargs):
        return self.client.post(path, headers=self.headers, **kwargs)

    def patch(self, path, **kwargs):
        return self.client.patch(path, headers=self.headers, **kwargs)

    def delete(self, path, **kwargs):
        return self.client.delete(path, headers=self.headers, **kwargs)

    def socket(self, room_id, query=""):
        return self.client.websocket_connect(f"/ws/rooms/{room_id}{query}", headers=self.headers)


TEST_ENCRYPTION_KEY = "MDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA="


def settings_for_test(**values):
    return Settings(_env_file=None, settings_encryption_key=TEST_ENCRYPTION_KEY,
                    bootstrap_admin_username="admin", bootstrap_admin_password="correct-password",
                    **values)


@pytest.fixture
def system(tmp_path):
    settings = settings_for_test(database_url=f"sqlite:///{tmp_path / 'test.db'}",
                             speech_download_root=str(tmp_path / "models"))
    translator, recognizer = FakeTranslator(), FakeRecognizer()
    app = create_app(settings, recognizer=recognizer, translator=translator)
    with TestClient(app) as client:
        yield client, app, translator, recognizer


@pytest.fixture
def actor(system):
    client, *_ = system

    def register(username):
        if username == "admin":
            response = client.post("/api/auth/login", json={
                "username": username, "password": "correct-password",
            })
            assert response.status_code == 200, response.text
            return Actor(client, response.json(), client.cookies.get(COOKIE_NAME))
        response = client.post("/api/auth/register", json={
            "username": username, "name": username, "email": f"{username}@example.com",
            "password": "correct-password", "password_confirmation": "correct-password",
        })
        assert response.status_code == 201, response.text
        return Actor(client, response.json(), client.cookies.get(COOKIE_NAME))
    return register


def wait_message(actor, room_id, status, count=1):
    for _ in range(200):
        messages = actor.get(f"/api/rooms/{room_id}/messages").json()["messages"]
        matches = [message for message in messages if message["status"] == status]
        if len(matches) >= count:
            return matches[-1]
        time.sleep(.01)
    raise AssertionError(f"Expected {count} {status} messages; got {messages}")
