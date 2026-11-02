from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session as DBSession
from starlette.websockets import WebSocketDisconnect

from app.auth import COOKIE_NAME, digest_token, passwords, verify_password
from app.models import Membership, Message, Room, Session, User, utcnow
from app.speech import Transcript
from tests.conftest import Actor, wait_message
from tests.test_application import make_room
from tests.test_speech import SILENCE, VOICE, MarkedVad

ANONYMOUS = {"cookie": "", "origin": "http://testserver"}


def invitation(owner):
    room_id = make_room(owner, "remote")
    token = owner.post(f"/api/rooms/{room_id}/invite").json()["token"]
    return room_id, token


def counts(app):
    with app.state.database.session() as db:
        return tuple(db.scalar(select(func.count()).select_from(model))
                     for model in (User, Session, Membership))


def anonymous_join(system, token, cookie=""):
    client, *_ = system
    response = client.post("/api/rooms/join", json={"token": token},
                           headers={**ANONYMOUS, "cookie": cookie})
    assert response.status_code == 200, response.text
    session_token = response.cookies.get(COOKIE_NAME)
    guest = Actor(client, {}, session_token)
    guest.user = guest.get("/api/auth/me").json()
    return guest, response


def test_anonymous_join_creates_guest_session_and_single_membership(system, actor):
    _, app, *_ = system
    owner = actor("alice")
    room_id, token = invitation(owner)
    before = counts(app)
    guest, response = anonymous_join(system, token)
    assert guest.user == {
        "id": guest.user["id"], "username": guest.user["username"],
        "name": "Khách", "email": None, "is_guest": True,
        "is_admin": False, "must_change_password": False,
    }
    assert guest.user["username"].startswith("guest_")
    assert len(guest.user["username"]) <= 32
    assert response.json()["id"] == room_id
    assert response.json()["side"] == "B"
    assert response.json()["members"][-1]["name"] == "Khách"
    assert counts(app) == tuple(value + 1 for value in before)
    assert guest.get("/api/config").status_code == 200
    assert [room["id"] for room in guest.get("/api/rooms").json()] == [room_id]
    assert guest.get(f"/api/rooms/{room_id}").json() == response.json()
    with app.state.database.session() as db:
        user = db.get(User, guest.user["id"])
        assert user.password_hash == "!guest"
        assert not verify_password("!guest", user.password_hash)
        session = db.get(Session, digest_token(guest.token))
        assert session.user_id == user.id
        assert db.get(Session, guest.token) is None
        assert db.get(Room, room_id).invite_digest is None
        assert db.get(Room, room_id).invite_expires_at is None
        member = db.scalar(select(Membership).where(Membership.user_id == user.id))
        assert member.room_id == room_id and member.side == "B"
    assert owner.user["is_guest"] is False


@pytest.mark.parametrize("secure", [False, True])
def test_guest_cookie_uses_account_security_and_configured_lifetime(system, actor, secure):
    _, app, *_ = system
    owner = actor("alice")
    _, token = invitation(owner)
    app.state.settings.cookie_secure = secure
    app.state.settings.session_days = 3
    before = utcnow()
    guest, response = anonymous_join(system, token)
    cookie = response.headers["set-cookie"]
    assert "HttpOnly" in cookie and "SameSite=lax" in cookie and "Path=/" in cookie
    assert "Max-Age=259200" in cookie
    assert ("Secure" in cookie) is secure
    with app.state.database.session() as db:
        session = db.get(Session, digest_token(guest.token))
        assert before + timedelta(days=3) <= session.expires_at <= utcnow() + timedelta(days=3)


@pytest.mark.parametrize("invalid", ["unknown", "expired", "null_expiry", "shared", "rotated", "consumed"])
def test_invalid_invite_creates_no_users_sessions_or_memberships(system, actor, invalid):
    client, app, *_ = system
    owner = actor("alice")
    room_id, token = invitation(owner)
    with app.state.database.session() as db:
        room = db.get(Room, room_id)
        if invalid == "unknown":
            token = "unknown-invitation-token"
        elif invalid == "expired":
            room.invite_expires_at = utcnow() - timedelta(seconds=1)
        elif invalid == "null_expiry":
            room.invite_expires_at = None
        elif invalid == "shared":
            room.mode = "shared"
        db.commit()
    if invalid == "rotated":
        owner.post(f"/api/rooms/{room_id}/invite")
    elif invalid == "consumed":
        anonymous_join(system, token)
    before = counts(app)
    response = client.post("/api/rooms/join", json={"token": token}, headers=ANONYMOUS)
    assert response.status_code == 404
    assert "set-cookie" not in response.headers
    assert counts(app) == before


def test_invite_expiring_exactly_now_is_invalid(system, actor, monkeypatch):
    client, app, *_ = system
    owner = actor("alice")
    room_id, token = invitation(owner)
    now = utcnow()
    with app.state.database.session() as db:
        db.get(Room, room_id).invite_expires_at = now
        db.commit()
    monkeypatch.setattr("app.main.utcnow", lambda: now)
    before = counts(app)
    assert client.post("/api/rooms/join", json={"token": token}, headers=ANONYMOUS).status_code == 404
    assert counts(app) == before


@pytest.mark.parametrize("identity", ["account", "guest", "owner"])
def test_valid_identity_is_reused_and_owner_self_join_does_not_consume_invite(system, actor, identity):
    _, app, *_ = system
    owner = actor("alice")
    if identity == "guest":
        _, initial_token = invitation(owner)
        joiner, _ = anonymous_join(system, initial_token)
    else:
        joiner = owner if identity == "owner" else actor("bobby")
    room_id, token = invitation(owner)
    before = counts(app)
    response = joiner.post("/api/rooms/join", json={"token": token})
    assert response.status_code == 200
    assert "set-cookie" not in response.headers
    assert response.json()["side"] == ("A" if identity == "owner" else "B")
    assert joiner.get("/api/auth/me").json() == joiner.user
    assert counts(app) == (before[0], before[1], before[2] + (identity != "owner"))
    with app.state.database.session() as db:
        room = db.get(Room, room_id)
        assert room.invite_digest == (digest_token(token) if identity == "owner" else None)
    if identity == "owner":
        assert joiner.post("/api/rooms/join", json={"token": token}).status_code == 200
        anonymous_join(system, token)


@pytest.mark.parametrize("cookie_state", ["invalid", "expired", "logged_out", "lost"])
def test_missing_valid_cookie_never_reclaims_guest_identity(system, actor, cookie_state):
    _, app, *_ = system
    owner = actor("alice")
    old_room, old_token = invitation(owner)
    old_guest, _ = anonymous_join(system, old_token)
    if cookie_state == "expired":
        with app.state.database.session() as db:
            db.get(Session, digest_token(old_guest.token)).expires_at = utcnow() - timedelta(seconds=1)
            db.commit()
    elif cookie_state == "logged_out":
        old_guest.post("/api/auth/logout")
    cookie = {"invalid": "not-a-session", "lost": ""}.get(cookie_state, old_guest.token)
    _, new_token = invitation(owner)
    guest, _ = anonymous_join(system, new_token, cookie=f"{COOKIE_NAME}={cookie}")
    assert guest.user["id"] != old_guest.user["id"]
    assert guest.user["username"] != old_guest.user["username"]
    assert guest.get(f"/api/rooms/{old_room}").status_code == 404
    assert guest.post("/api/rooms/join", json={"token": old_token}).status_code == 404


def test_guest_login_is_excluded_even_if_password_hash_is_valid(system, actor):
    client, app, *_ = system
    owner = actor("alice")
    _, token = invitation(owner)
    guest, _ = anonymous_join(system, token)
    with app.state.database.session() as db:
        db.get(User, guest.user["id"]).password_hash = passwords.hash("known-password")
        db.commit()
    before = counts(app)
    response = client.post("/api/auth/login", json={
        "username": guest.user["username"], "password": "known-password",
    }, headers=ANONYMOUS)
    assert response.status_code == 401 and "set-cookie" not in response.headers
    assert counts(app) == before


def test_guest_permissions_messages_retry_and_other_room_isolation(system, actor):
    _, app, translator, _ = system
    owner = actor("alice")
    room_id, token = invitation(owner)
    other_room = make_room(owner)
    guest, _ = anonymous_join(system, token)
    assert guest.post("/api/rooms", json={}).status_code == 403
    assert guest.patch("/api/auth/me", json={"email": "guest@example.com"}).status_code == 403
    for target in [room_id, other_room, "missing-room"]:
        assert guest.post(f"/api/rooms/{target}/invite").status_code == 403
        assert guest.delete(f"/api/rooms/{target}").status_code == 403
    assert guest.get("/api/auth/me").json() == guest.user
    assert guest.get(f"/api/rooms/{other_room}").status_code == 404
    assert guest.get(f"/api/rooms/{other_room}/messages").status_code == 404
    payload = {"text": "Hello", "client_message_id": "guest-http-message"}
    assert guest.post(f"/api/rooms/{other_room}/messages", json=payload).status_code == 404
    assert guest.post(f"/api/rooms/{room_id}/messages", json={**payload, "speaker": "A"}).status_code == 403
    translator.fail = True
    response = guest.post(f"/api/rooms/{room_id}/messages", json=payload)
    assert response.status_code == 201
    assert response.json()["author_id"] == guest.user["id"]
    assert response.json()["speaker"] == "B"
    failed = wait_message(guest, room_id, "error")
    message_id = failed["id"]
    assert guest.post(f"/api/rooms/{other_room}/messages/{message_id}/retry").status_code == 404
    assert guest.post(f"/api/rooms/{other_room}/messages/{message_id}/speaker", json={"speaker": "B"}).status_code == 404
    # Remote-room speaker assignment is already determined by membership, for guests too.
    assert guest.post(f"/api/rooms/{room_id}/messages/{message_id}/speaker", json={"speaker": "B"}).status_code == 409
    translator.fail = False
    assert guest.post(f"/api/rooms/{room_id}/messages/{message_id}/retry").status_code == 200
    translated = wait_message(guest, room_id, "translated")
    assert translated["source_language"] == "en" and translated["target_language"] == "vi"
    assert translated["translation"] == "Xin chào"
    with pytest.raises(WebSocketDisconnect) as closed:
        with guest.socket(other_room):
            pass
    assert closed.value.code == 4404
    with app.state.database.session() as db:
        assert db.get(User, guest.user["id"]).email is None
    assert owner.delete(f"/api/rooms/{room_id}").status_code == 204
    assert guest.get("/api/rooms").json() == []


def test_guest_websocket_text_voice_and_reconnect(system, actor, monkeypatch):
    _, app, _, recognizer = system
    monkeypatch.setattr("app.speech.webrtcvad.Vad", lambda _: MarkedVad())
    recognizer.result = Transcript("Hello", "en", .99)
    owner = actor("alice")
    room_id, token = invitation(owner)
    guest, _ = anonymous_join(system, token)
    with guest.socket(room_id) as socket:
        snapshot = socket.receive_json()
        assert snapshot["type"] == "room.snapshot" and snapshot["room"]["side"] == "B"
        socket.send_json({"type": "text.submit", "text": "Hello", "client_message_id": "guest-socket-text", "speaker": "A"})
        assert socket.receive_json()["type"] == "error"
        socket.send_json({"type": "text.submit", "text": "Hello", "client_message_id": "guest-socket-text"})
        events = [socket.receive_json() for _ in range(3)]
        assert {item["type"] for item in events} == {"message.upsert", "message.ack"}
        assert any(item["message"]["status"] == "translated" for item in events)
        socket.send_json({"type": "audio.start", "capture_id": "guest-voice"})
        assert socket.receive_json() == {"type": "audio.state", "recording": True, "capture_id": "guest-voice"}
        socket.send_bytes(VOICE * 25)
        socket.send_bytes(SILENCE * 20)
        socket.send_json({"type": "audio.stop", "capture_id": "guest-voice"})
        wait_message(guest, room_id, "translated", count=2)
    with guest.socket(room_id) as socket:
        snapshot = socket.receive_json()
        assert len(snapshot["messages"]) == 2
        voice = next(message for message in snapshot["messages"] if message["source"] == "voice")
        assert voice["author_id"] == guest.user["id"] and voice["speaker"] == "B"
        assert voice["translation"] == "Xin chào"
    assert recognizer.calls and all(language == "en" for _, language in recognizer.calls)
    assert len(owner.get(f"/api/rooms/{room_id}/messages").json()["messages"]) == 2
    with app.state.database.session() as db:
        assert db.scalar(select(func.count()).select_from(Message)) == 2


@pytest.mark.parametrize("revocation", ["logout", "expiry"])
def test_guest_session_revocation_closes_socket_and_denies_http(system, actor, revocation):
    _, app, *_ = system
    owner = actor("alice")
    room_id, token = invitation(owner)
    guest, _ = anonymous_join(system, token)
    with guest.socket(room_id) as socket:
        socket.receive_json()
        if revocation == "logout":
            response = guest.post("/api/auth/logout")
            assert response.status_code == 204
            assert "Max-Age=0" in response.headers["set-cookie"]
        else:
            with app.state.database.session() as db:
                db.get(Session, digest_token(guest.token)).expires_at = utcnow() - timedelta(seconds=1)
                db.commit()
            socket.send_json({"type": "text.submit", "text": "denied", "client_message_id": "expired-message"})
        with pytest.raises(WebSocketDisconnect) as closed:
            socket.receive_json()
        assert closed.value.code == 4401
    for path in ["/api/auth/me", "/api/config", "/api/rooms", f"/api/rooms/{room_id}/messages"]:
        assert guest.get(path).status_code == 401
    with pytest.raises(WebSocketDisconnect) as closed:
        with guest.socket(room_id):
            pass
    assert closed.value.code == 4401
    with app.state.database.session() as db:
        assert db.get(User, guest.user["id"]).is_guest
        assert db.scalar(select(Message)) is None


def test_join_uses_shared_auth_rate_limiter_and_origin_protection(system, actor):
    client, app, *_ = system
    owner = actor("alice")  # One attempt in the shared bucket.
    _, token = invitation(owner)
    before = counts(app)
    response = client.post("/api/rooms/join", json={"token": token},
                           headers={**ANONYMOUS, "origin": "https://evil.example"})
    assert response.status_code == 403
    app.state.settings.auth_rate_limit = 2
    assert client.post("/api/rooms/join", json={"token": "invalid-invitation-token"}, headers=ANONYMOUS).status_code == 404
    response = client.post("/api/rooms/join", json={"token": token}, headers=ANONYMOUS)
    assert response.status_code == 429 and "set-cookie" not in response.headers
    assert client.post("/api/auth/login", json={"username": "alice", "password": "correct-password"}).status_code == 429
    assert counts(app) == before


@pytest.mark.parametrize("failure", ["full_room", "session_flush", "commit"])
def test_failed_guest_join_rolls_back_identity_session_and_invite(system, actor, monkeypatch, failure):
    client, app, *_ = system
    owner = actor("alice")
    room_id, token = invitation(owner)
    if failure == "full_room":
        existing = actor("bobby")
        with app.state.database.session() as db:
            db.add(Membership(room_id=room_id, user_id=existing.user["id"], side="B"))
            db.commit()
    before = counts(app)

    def fail_before_flush(db, *_):
        if any(isinstance(row, Session) for row in db.new):
            raise IntegrityError("injected session insert failure", {}, Exception("failure"))

    original_commit = DBSession.commit

    def fail_commit(db):
        db.flush()  # Exercise rollback after guest, session and membership inserts.
        raise IntegrityError("injected commit failure", {}, Exception("failure"))

    if failure == "session_flush":
        event.listen(DBSession, "before_flush", fail_before_flush)
    elif failure == "commit":
        monkeypatch.setattr(DBSession, "commit", fail_commit)
    try:
        response = client.post("/api/rooms/join", json={"token": token}, headers=ANONYMOUS)
    finally:
        if failure == "session_flush":
            event.remove(DBSession, "before_flush", fail_before_flush)
        elif failure == "commit":
            monkeypatch.setattr(DBSession, "commit", original_commit)
    assert response.status_code == 409 and "set-cookie" not in response.headers
    assert counts(app) == before
    with app.state.database.session() as db:
        room = db.get(Room, room_id)
        assert room.invite_digest == digest_token(token) and room.invite_expires_at is not None
    if failure != "full_room":
        anonymous_join(system, token)


@pytest.mark.parametrize("signed_in_competitor", [False, True])
def test_concurrent_invite_claims_leave_no_orphan_guest_rows(system, actor, signed_in_competitor):
    _, app, *_ = system
    owner = actor("alice")
    room_id, token = invitation(owner)
    competitor = actor("bobby") if signed_in_competitor else None
    before = counts(app)
    barrier = Barrier(2)

    def synchronize_reads(conn, cursor, statement, parameters, context, executemany):
        if statement.startswith("SELECT rooms.") and "WHERE rooms.invite_digest =" in statement:
            barrier.wait(timeout=5)

    def join_in_separate_worker(headers):
        # No lifespan context: each request runs on its own portal/event loop,
        # while the fixture owns the app lifespan. Force both to read the invite.
        with_client = TestClient(app)
        try:
            return with_client.post("/api/rooms/join", json={"token": token}, headers=headers)
        finally:
            with_client.close()

    event.listen(app.state.database.engine, "after_cursor_execute", synchronize_reads)
    try:
        with ThreadPoolExecutor(2) as pool:
            responses = list(pool.map(join_in_separate_worker, [ANONYMOUS, competitor.headers if competitor else ANONYMOUS]))
    finally:
        event.remove(app.state.database.engine, "after_cursor_execute", synchronize_reads)
    assert sorted(response.status_code for response in responses) == [200, 404]
    winner = next(response for response in responses if response.status_code == 200)
    loser = next(response for response in responses if response.status_code != 200)
    assert "set-cookie" not in loser.headers
    guests_added = int(COOKIE_NAME in winner.cookies)
    assert counts(app) == (before[0] + guests_added, before[1] + guests_added, before[2] + 1)
    with app.state.database.session() as db:
        assert db.get(Room, room_id).invite_digest is None
        assert db.scalar(select(func.count()).select_from(User).where(User.is_guest.is_(True))) == guests_added
