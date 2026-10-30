from datetime import timedelta
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import select, text

from app.auth import COOKIE_NAME, digest_token, passwords
from app.config import Settings
from app.db import Database
from app.main import create_app
from app.models import User, utcnow
from tests.fakes import FakeRecognizer, FakeTranslator


def registration(**changes):
    return {
        "username": "new_account", "name": "  Nguyễn Sơn  ", "email": "  Son@Example.com  ",
        "password": "correct-password", "password_confirmation": "correct-password", **changes,
    }


def test_registration_saves_normalized_profile_and_keeps_email_private(system):
    client, app, *_ = system
    response = client.post("/api/auth/register", json=registration())
    assert response.status_code == 201, response.text
    profile = response.json()
    assert profile == {
        "id": profile["id"], "username": "new_account", "name": "Nguyễn Sơn", "email": "son@example.com",
    }
    assert client.get("/api/auth/me").json() == profile
    room = client.post("/api/rooms", json={}).json()
    assert room["members"] == [{"side": "A", "username": "new_account", "name": "Nguyễn Sơn"}]
    with app.state.database.session() as db:
        user = db.get(User, profile["id"])
        assert user.name == "Nguyễn Sơn"
        assert user.email == "son@example.com"
        assert passwords.verify(user.password_hash, "correct-password")


@pytest.mark.parametrize("changes", [
    {"name": "   "}, {"name": "x" * 101}, {"email": "invalid-email"},
    {"email": ""}, {"password_confirmation": "another-password"},
])
def test_registration_rejects_invalid_profile_without_creating_account(system, changes):
    client, app, *_ = system
    assert client.post("/api/auth/register", json=registration(**changes)).status_code == 422
    with app.state.database.session() as db:
        assert db.scalar(select(User)) is None


@pytest.mark.parametrize("missing", ["name", "email", "password_confirmation"])
def test_registration_requires_new_fields(system, missing):
    client, *_ = system
    payload = registration()
    payload.pop(missing)
    assert client.post("/api/auth/register", json=payload).status_code == 422


def test_email_changes_require_session_persist_and_do_not_modify_other_users(system, actor):
    client, app, *_ = system
    alice, bob = actor("alice"), actor("bob")
    client.cookies.clear()
    assert client.patch("/api/auth/me", json={"email": "someone@example.com"}).status_code == 401
    assert alice.patch("/api/auth/me", json={"email": "not-an-email"}).status_code == 422
    assert alice.patch("/api/auth/me", json={"email": ""}).status_code == 422
    assert alice.patch("/api/auth/me", json={
        "email": "someone@example.com", "user_id": bob.user["id"],
    }).status_code == 422
    assert client.patch("/api/auth/me", json={"email": "someone@example.com"}, headers={
        **alice.headers, "origin": "https://another-site.example",
    }).status_code == 403
    response = alice.patch("/api/auth/me", json={"email": "  New.Alice@Example.com  "})
    assert response.status_code == 200, response.text
    assert response.json() == {**alice.user, "email": "new.alice@example.com"}
    assert alice.get("/api/auth/me").json()["email"] == "new.alice@example.com"
    assert bob.get("/api/auth/me").json() == bob.user
    assert alice.post("/api/auth/logout").status_code == 204
    login = client.post("/api/auth/login", json={"username": "alice", "password": "correct-password"})
    assert login.status_code == 200
    assert login.json()["email"] == "new.alice@example.com"
    with app.state.database.session() as db:
        assert db.get(User, alice.user["id"]).email == "new.alice@example.com"


def test_duplicate_emails_are_rejected_without_changing_the_account(system, actor):
    client, *_ = system
    alice, bob = actor("alice"), actor("bob")
    assert client.post("/api/auth/register", json=registration(email="ALICE@EXAMPLE.COM")).status_code == 409
    assert bob.patch("/api/auth/me", json={"email": "ALICE@EXAMPLE.COM"}).status_code == 409
    assert bob.get("/api/auth/me").json() == bob.user
    assert alice.patch("/api/auth/me", json={"email": "ALICE@EXAMPLE.COM"}).status_code == 200


def test_legacy_migration_preserves_accounts_sessions_and_conversations(tmp_path):
    settings = Settings(_env_file=None, database_url=f"sqlite:///{tmp_path / 'legacy.db'}",
                        speech_enabled=False)
    legacy = Database(settings.database_url)
    root = Path(__file__).resolve().parent.parent
    config = Config(str(root / "alembic.ini"))
    config.set_main_option("script_location", str(root / "migrations"))
    token, now = "existing-session-token", utcnow()
    stored_time = now.isoformat(sep=" ")
    with legacy.engine.begin() as conn:
        config.attributes["connection"] = conn
        command.upgrade(config, "0001")
        for username in ["legacy", "another_legacy"]:
            conn.execute(text("INSERT INTO users (id, username, password_hash, created_at) "
                              "VALUES (:id, :username, :password_hash, :now)"), {
                "id": username, "username": username, "password_hash": passwords.hash("old-password"),
                "now": stored_time,
            })
        conn.execute(text("INSERT INTO sessions (digest, user_id, expires_at) "
                          "VALUES (:digest, 'legacy', :expires)"), {
            "digest": digest_token(token), "expires": (now + timedelta(days=1)).isoformat(sep=" "),
        })
        conn.execute(text("INSERT INTO rooms (id, owner_id, title, mode, language_a, language_b, "
                          "created_at, updated_at) VALUES ('old-room', 'legacy', 'Old conversation', "
                          "'shared', 'vi', 'en', :now, :now)"), {"now": stored_time})
        conn.execute(text("INSERT INTO memberships (id, room_id, user_id, side) "
                          "VALUES ('old-member', 'old-room', 'legacy', 'A')"))
        conn.execute(text("INSERT INTO messages (id, room_id, author_id, client_message_id, source, "
                          "speaker, source_language, target_language, text, translation, status, "
                          "version, created_at, updated_at) VALUES ('old-message', 'old-room', "
                          "'legacy', 'old-client-message', 'text', 'A', 'vi', 'en', 'Xin chào', "
                          "'Hello', 'done', 1, :now, :now)"), {"now": stored_time})
    legacy.engine.dispose()

    app = create_app(settings, recognizer=FakeRecognizer(), translator=FakeTranslator())
    with TestClient(app) as client:
        client.cookies.set(COOKIE_NAME, token)
        assert client.get("/api/auth/me").json() == {
            "id": "legacy", "username": "legacy", "name": "legacy", "email": None,
        }
        rooms = client.get("/api/rooms").json()
        assert [room["id"] for room in rooms] == ["old-room"]
        assert rooms[0]["members"][0]["name"] == "legacy"
        history = client.get("/api/rooms/old-room/messages").json()["messages"]
        assert len(history) == 1
        assert history[0]["id"] == "old-message"
        assert history[0]["translation"] == "Hello"
        with app.state.database.session() as db:
            for user in db.scalars(select(User)):
                assert user.name == user.username
                assert user.email is None
        response = client.patch("/api/auth/me", json={"email": "legacy@example.com"})
        assert response.status_code == 200
        assert response.json()["email"] == "legacy@example.com"
        login = client.post("/api/auth/login", json={"username": "legacy", "password": "old-password"})
        assert login.status_code == 200
        assert login.json()["name"] == "legacy"
        assert login.json()["email"] == "legacy@example.com"
