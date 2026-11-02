from datetime import timedelta
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import delete, func, select, text
from starlette.websockets import WebSocketDisconnect

from app.auth import COOKIE_NAME, digest_token, passwords, verify_password
from app.config import Settings
from app.db import Database
from app.models import Membership, Message, Room, Session, User, utcnow
from tests.conftest import Actor
from tests.test_application import make_room
from tests.test_guest_join import ANONYMOUS, anonymous_join, invitation

BASE = "/api/admin/accounts"
NEW_PASSWORD = {"new_password": "replacement-password", "new_password_confirmation": "replacement-password"}
CHANGE_PASSWORD = {"current_password": "correct-password", **NEW_PASSWORD}


def receive_type(socket, kind):
    for _ in range(20):
        event = socket.receive_json()
        if event["type"] == kind:
            return event
    raise AssertionError(f"Did not receive {kind}")


def login(client, username, password="correct-password"):
    return client.post("/api/auth/login", json={"username": username, "password": password}, headers=ANONYMOUS)


def test_admin_default_and_case_insensitive_configuration(system, actor):
    _, app, *_ = system
    assert Settings.model_fields["admin_usernames"].default == "admin"
    admin = actor("admin")
    assert admin.user["is_admin"] is True
    assert admin.get(BASE).status_code == 200
    app.state.settings.admin_usernames = " ADMIN , Supervisor, , "
    assert app.state.settings.admin_usernames_set == {"admin", "supervisor"}
    supervisor = actor("supervisor")
    assert supervisor.user["is_admin"] is True
    assert supervisor.get(BASE).status_code == 200
    app.state.settings.admin_usernames = ""
    assert admin.get(BASE).status_code == 403
    assert admin.get("/api/auth/me").json()["is_admin"] is False


def test_admin_permission_matrix_and_private_profiles(system, actor):
    client, *_ = system
    admin, normal = actor("admin"), actor("normal")
    _, token = invitation(normal)
    guest, _ = anonymous_join(system, token)
    for person in (admin, normal, guest):
        profile = person.get("/api/auth/me").json()
        assert profile == person.user
        assert profile["must_change_password"] is False
        assert "password_hash" not in profile
    operations = [
        ("get", BASE, None),
        ("patch", f"{BASE}/{normal.user['id']}", {"is_active": False}),
        ("post", f"{BASE}/{normal.user['id']}/password", NEW_PASSWORD),
        ("delete", f"{BASE}/{normal.user['id']}", None),
    ]
    for method, path, body in operations:
        kwargs = {"json": body} if body is not None else {}
        assert getattr(client, method)(path, headers=ANONYMOUS, **kwargs).status_code == 401
        for person in (normal, guest):
            response = getattr(person, method)(path, **kwargs)
            assert response.status_code == 403
            assert response.json()["detail"] == "Bạn không có quyền quản trị."
    item = admin.get(BASE).json()["items"][0]
    assert set(item) == {"id", "username", "name", "email", "is_guest", "is_admin", "is_active",
                         "must_change_password", "created_at", "session_count", "room_count"}


def test_account_list_search_filters_counts_and_ordering(system, actor):
    _, app, *_ = system
    admin, alice, bob = actor("admin"), actor("alice"), actor("bob")
    _, token = invitation(alice)
    guest, _ = anonymous_join(system, token)
    with app.state.database.session() as db:
        db.get(User, alice.user["id"]).name = r"Unique Person \ 100%"
        db.add(Session(digest="expired-session", user_id=alice.user["id"],
                       expires_at=utcnow() - timedelta(seconds=1)))
        db.get(User, bob.user["id"]).email = "special@example.org"
        db.get(User, bob.user["id"]).is_active = False
        # Force a timestamp tie to verify the secondary username ordering.
        for account in db.scalars(select(User)):
            account.created_at = utcnow().replace(microsecond=0)
        db.commit()
    data = admin.get(BASE).json()
    assert data["total"] == 4 and data["page"] == 1 and data["page_size"] == 25
    assert [item["username"] for item in data["items"]] == sorted(["admin", "alice", "bob", guest.user["username"]])
    alice_item = next(item for item in data["items"] if item["id"] == alice.user["id"])
    assert alice_item["session_count"] == 1 and alice_item["room_count"] == 1
    for query, expected in [(" ALICE ", alice), ("unique PERSON", alice), (r"100%", alice), ("SPECIAL@", bob)]:
        assert [item["id"] for item in admin.get(BASE, params={"query": query}).json()["items"]] == [expected.user["id"]]
    for query in ("%", "_", "\\", "not-found"):
        assert admin.get(BASE, params={"query": query}).json()["total"] == (0 if query == "not-found" else 1)
    for role, ids in [("admin", {admin.user["id"]}), ("user", {alice.user["id"], bob.user["id"]}),
                      ("guest", {guest.user["id"]})]:
        assert {item["id"] for item in admin.get(BASE, params={"role": role}).json()["items"]} == ids
    assert admin.get(BASE, params={"status": "active"}).json()["total"] == 3
    assert admin.get(BASE, params={"status": "locked"}).json()["items"][0]["id"] == bob.user["id"]
    assert admin.get(BASE, params={"role": "user", "status": "locked", "query": "bob"}).json()["total"] == 1
    first = admin.get(BASE, params={"page_size": 1}).json()
    second = admin.get(BASE, params={"page_size": 1, "page": 2}).json()
    assert first["total"] == second["total"] == 4
    assert first["items"][0]["id"] != second["items"][0]["id"]
    assert admin.get(BASE, params={"page": 100}).json()["items"] == []
    assert admin.get(BASE, params={"page_size": 100}).status_code == 200


@pytest.mark.parametrize("params", [{"page_size": 0}, {"page_size": 101}, {"page": 0},
                                         {"role": "invalid"}, {"status": "invalid"}, {"query": "a" * 101}])
def test_account_list_rejects_invalid_filters(actor, params):
    assert actor("admin").get(BASE, params=params).status_code == 422


def test_lock_revokes_sessions_closes_socket_and_unlocks(system, actor):
    client, app, *_ = system
    admin, alice = actor("admin"), actor("alice")
    room_id = make_room(alice)
    with alice.socket(room_id) as socket:
        receive_type(socket, "room.snapshot")
        response = admin.patch(f"{BASE}/{alice.user['id']}", json={"is_active": False})
        assert response.status_code == 200
        assert response.json()["is_active"] is False and response.json()["session_count"] == 0
        with pytest.raises(WebSocketDisconnect) as closed:
            socket.receive_json()
        assert closed.value.code == 4401
    assert alice.get("/api/auth/me").status_code == 401
    assert alice.get("/api/rooms").status_code == 401
    assert admin.patch(f"{BASE}/{alice.user['id']}", json={"is_active": False}).status_code == 200
    response = login(client, "alice")
    assert response.status_code == 403
    assert response.json()["detail"] == "Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên."
    assert admin.patch(f"{BASE}/{alice.user['id']}", json={"is_active": True}).status_code == 200
    assert admin.patch(f"{BASE}/{alice.user['id']}", json={"is_active": True}).status_code == 200
    assert alice.get("/api/auth/me").status_code == 401  # Unlock does not revive old sessions.
    assert login(client, "alice").status_code == 200
    # Even an unrevoked session must be rejected for an inactive account.
    with app.state.database.session() as db:
        db.get(User, alice.user["id"]).is_active = False
        db.commit()
    assert client.get("/api/auth/me").status_code == 401


@pytest.mark.parametrize("target", ["admin", "supervisor", "missing"])
def test_admin_targets_are_protected_and_unknown_targets_are_not_found(system, actor, target):
    _, app, *_ = system
    app.state.settings.admin_usernames = "admin,supervisor"
    admin, supervisor = actor("admin"), actor("supervisor")
    user_id = {"admin": admin.user["id"], "supervisor": supervisor.user["id"], "missing": "unknown"}[target]
    expected = 404 if target == "missing" else 403
    assert admin.patch(f"{BASE}/{user_id}", json={"is_active": False}).status_code == expected
    assert admin.post(f"{BASE}/{user_id}/password", json=NEW_PASSWORD).status_code == expected
    assert admin.delete(f"{BASE}/{user_id}").status_code == expected
    assert supervisor.get("/api/auth/me").status_code == 200
    assert admin.get("/api/auth/me").status_code == 200


def test_password_reset_revokes_all_sessions_and_requires_change(system, actor):
    client, app, *_ = system
    admin, alice = actor("admin"), actor("alice")
    room_id = make_room(alice)
    response = login(client, "alice")
    second = Actor(client, response.json(), response.cookies[COOKIE_NAME])
    with alice.socket(room_id) as socket:
        receive_type(socket, "room.snapshot")
        response = admin.post(f"{BASE}/{alice.user['id']}/password", json=NEW_PASSWORD)
        assert response.status_code == 200
        assert response.json()["must_change_password"] is True
        assert response.json()["session_count"] == 0
        with pytest.raises(WebSocketDisconnect):
            socket.receive_json()
    assert alice.get("/api/auth/me").status_code == second.get("/api/auth/me").status_code == 401
    assert login(client, "alice").status_code == 401
    response = login(client, "alice", "replacement-password")
    assert response.status_code == 200 and response.json()["must_change_password"] is True
    with app.state.database.session() as db:
        assert verify_password("replacement-password", db.get(User, alice.user["id"]).password_hash)
    _, token = invitation(admin)
    guest, _ = anonymous_join(system, token)
    assert admin.post(f"{BASE}/{guest.user['id']}/password", json=NEW_PASSWORD).status_code == 409


def test_delete_cascades_owned_rooms_but_updates_remaining_memberships(system, actor):
    _, app, *_ = system
    admin, alice, bob = actor("admin"), actor("alice"), actor("bob")
    owned_room, token = invitation(alice)
    assert bob.post("/api/rooms/join", json={"token": token}).status_code == 200
    remaining_room, token = invitation(bob)
    assert alice.post("/api/rooms/join", json={"token": token}).status_code == 200
    with app.state.database.session() as db:
        db.add(Message(room_id=owned_room, author_id=alice.user["id"], client_message_id="owned-message",
                       source="text", text="test", status="done"))
        db.add(Message(room_id=remaining_room, author_id=bob.user["id"], client_message_id="retained-message",
                       source="text", text="retained", status="done"))
        db.commit()
    with bob.socket(owned_room) as owned_socket, bob.socket(remaining_room) as remaining_socket:
        receive_type(owned_socket, "room.snapshot")
        receive_type(remaining_socket, "room.snapshot")
        response = admin.delete(f"{BASE}/{alice.user['id']}")
        assert response.status_code == 204 and response.content == b""
        assert receive_type(owned_socket, "room.deleted") == {"type": "room.deleted"}
        with pytest.raises(WebSocketDisconnect):
            owned_socket.receive_json()
        members = receive_type(remaining_socket, "room.members")
        assert members["members"] == [{"side": "A", "username": "bob", "name": "bob"}]
        remaining_socket.send_json({"type": "audio.stop"})
        assert receive_type(remaining_socket, "audio.state")["recording"] is False
    assert bob.get(f"/api/rooms/{owned_room}").status_code == 404
    assert bob.get(f"/api/rooms/{remaining_room}").status_code == 200
    assert alice.get("/api/auth/me").status_code == 401
    with app.state.database.session() as db:
        assert db.get(User, alice.user["id"]) is None
        assert db.get(Room, owned_room) is None
        assert db.scalar(select(func.count()).select_from(Message).where(Message.room_id == owned_room)) == 0
        assert db.scalar(select(func.count()).select_from(Session).where(Session.user_id == alice.user["id"])) == 0
        assert db.scalar(select(func.count()).select_from(Membership).where(Membership.user_id == alice.user["id"])) == 0
        assert db.scalar(select(Message.text).where(Message.room_id == remaining_room)) == "retained"
        assert db.execute(text("PRAGMA foreign_key_check")).all() == []


@pytest.mark.parametrize("payload,expected", [
    ({**CHANGE_PASSWORD, "current_password": "incorrect-password"}, 403),
    ({**CHANGE_PASSWORD, "new_password_confirmation": "different-password"}, 422),
    ({"current_password": "correct-password", "new_password": "correct-password",
      "new_password_confirmation": "correct-password"}, 422),
    ({**CHANGE_PASSWORD, "new_password": "short", "new_password_confirmation": "short"}, 422),
])
def test_password_change_validation(actor, payload, expected):
    alice = actor("alice")
    assert alice.post("/api/auth/password", json=payload).status_code == expected
    assert alice.get("/api/auth/me").status_code == 200


def test_password_change_requires_account(system, actor):
    client, *_ = system
    assert client.post("/api/auth/password", json=CHANGE_PASSWORD, headers=ANONYMOUS).status_code == 401
    owner = actor("owner")
    _, token = invitation(owner)
    guest, _ = anonymous_join(system, token)
    assert guest.post("/api/auth/password", json=CHANGE_PASSWORD).status_code == 403


def test_password_change_keeps_current_session_and_socket_only(system, actor):
    _, app, *_ = system
    alice = actor("alice")
    room_id = make_room(alice)
    with app.state.database.session() as db:
        db.get(User, alice.user["id"]).must_change_password = True
        db.commit()
    # A genuinely separate HTTP client ensures its cookie jar is independent.
    second_client = TestClient(app)
    try:
        response = login(second_client, "alice")
        # Share the app's lifespan portal for websockets, but retain the
        # independently authenticated client's token and HTTP cookie jar.
        second = Actor(alice.client, response.json(), response.cookies[COOKIE_NAME])
        with alice.socket(room_id) as current_socket, second.socket(room_id) as other_socket:
            receive_type(current_socket, "room.snapshot")
            receive_type(other_socket, "room.snapshot")
            response = alice.post("/api/auth/password", json=CHANGE_PASSWORD)
            assert response.status_code == 200
            assert response.json()["must_change_password"] is False
            with pytest.raises(WebSocketDisconnect):
                other_socket.receive_json()
            current_socket.send_json({"type": "audio.stop"})
            assert receive_type(current_socket, "audio.state")["recording"] is False
        assert alice.get("/api/auth/me").status_code == 200
        assert second.get("/api/auth/me").status_code == 401
        assert login(second_client, "alice").status_code == 401
        assert login(second_client, "alice", "replacement-password").status_code == 200
        with app.state.database.session() as db:
            assert db.get(Session, digest_token(alice.token)) is not None
            assert db.get(User, alice.user["id"]).must_change_password is False
    finally:
        second_client.close()


@pytest.mark.parametrize("intervening", ["password", "lock", "revoke", "expire"])
def test_password_change_rejects_stale_verification(system, actor, monkeypatch, intervening):
    _, app, *_ = system
    alice = actor("alice")
    replacement_hash = passwords.hash("intervening-password")

    def verify_then_change(password, hashed):
        verified = verify_password(password, hashed)
        with app.state.database.session() as db:
            account = db.get(User, alice.user["id"])
            if intervening == "password":
                account.password_hash = replacement_hash
                account.must_change_password = True
            elif intervening == "lock":
                account.is_active = False
            elif intervening == "revoke":
                db.execute(delete(Session).where(Session.user_id == alice.user["id"]))
            else:
                db.get(Session, digest_token(alice.token)).expires_at = utcnow() - timedelta(seconds=1)
            db.commit()
        return verified

    monkeypatch.setattr("app.main.verify_password", verify_then_change)
    assert alice.post("/api/auth/password", json=CHANGE_PASSWORD).status_code == 401
    with app.state.database.session() as db:
        account = db.get(User, alice.user["id"])
        assert not verify_password("replacement-password", account.password_hash)
        if intervening == "password":
            assert account.password_hash == replacement_hash and account.must_change_password is True


def test_admin_migration_preserves_0003_rows_and_server_defaults(tmp_path):
    database = Database(f"sqlite:///{tmp_path / 'admin.db'}")
    root = Path(__file__).resolve().parent.parent
    config = Config(str(root / "alembic.ini"))
    config.set_main_option("script_location", str(root / "migrations"))
    try:
        with database.engine.begin() as conn:
            config.attributes["connection"] = conn
            command.upgrade(config, "0003")
            now = utcnow().isoformat(sep=" ")
            for user_id, is_guest in [("existing", 0), ("guest", 1)]:
                conn.execute(text("INSERT INTO users (id, username, name, email, password_hash, is_guest, created_at) "
                                  "VALUES (:id, :id, 'Original', NULL, 'stored-hash', :guest, :now)"),
                             {"id": user_id, "guest": is_guest, "now": now})
            conn.execute(text("INSERT INTO sessions (digest, user_id, expires_at) VALUES ('digest', 'existing', :now)"),
                         {"now": now})
            conn.execute(text("INSERT INTO rooms (id, owner_id, title, mode, language_a, language_b, created_at, updated_at) "
                              "VALUES ('room', 'existing', 'Title', 'remote', 'vi', 'en', :now, :now)"), {"now": now})
            conn.execute(text("INSERT INTO memberships (id, room_id, user_id, side) VALUES ('member', 'room', 'guest', 'B')"))
            before = [dict(row) for row in conn.execute(text("SELECT * FROM users ORDER BY id")).mappings()]
            relations = {table: conn.execute(text(f"SELECT * FROM {table}")).all()
                         for table in ("sessions", "rooms", "memberships")}
            command.upgrade(config, "0004")
            after = [dict(row) for row in conn.execute(text("SELECT * FROM users ORDER BY id")).mappings()]
            assert after == [{**row, "is_active": 1, "must_change_password": 0} for row in before]
            for table, rows in relations.items():
                assert conn.execute(text(f"SELECT * FROM {table}")).all() == rows
            conn.execute(text("INSERT INTO users (id, username, password_hash, created_at) "
                              "VALUES ('default', 'default', 'hash', :now)"), {"now": now})
            assert conn.execute(text("SELECT is_active, must_change_password FROM users WHERE id = 'default'")).one() == (1, 0)
            assert conn.execute(text("PRAGMA foreign_key_check")).all() == []
            command.downgrade(config, "0003")
            assert [dict(row) for row in conn.execute(text("SELECT * FROM users WHERE id != 'default' ORDER BY id")).mappings()] == before
            command.upgrade(config, "head")
            assert conn.execute(text("PRAGMA foreign_key_check")).all() == []
        with database.session() as db:
            account = db.get(User, "existing")
            assert account.is_active is True and account.must_change_password is False
            assert account.password_hash == "stored-hash" and account.name == "Original"
    finally:
        database.engine.dispose()
