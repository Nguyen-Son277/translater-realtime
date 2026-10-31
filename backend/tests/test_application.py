from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta

import pytest
from sqlalchemy import func, select
from starlette.websockets import WebSocketDisconnect

from app.auth import COOKIE_NAME, digest_token
from app.models import Membership, Message, Session, User, utcnow
from tests.conftest import Actor, wait_message


def make_room(owner, mode="shared"):
    response = owner.post("/api/rooms", json={"mode": mode, "title": "Buổi cà phê"})
    assert response.status_code == 201, response.text
    return response.json()["id"]


def join(owner, guest, room_id):
    invitation = owner.post(f"/api/rooms/{room_id}/invite").json()["token"]
    response = guest.post("/api/rooms/join", json={"token": invitation})
    assert response.status_code == 200, response.text
    return invitation


def test_authentication_password_hash_and_cookie(system, actor):
    client, app, *_ = system
    owner = actor("Alice")
    assert owner.user["username"] == "alice"
    assert owner.get("/api/auth/me").json() == owner.user
    with app.state.database.session() as db:
        user = db.get(User, owner.user["id"])
        assert user.password_hash.startswith("$argon2id$")
        assert db.get(Session, digest_token(owner.token))
        assert db.get(Session, owner.token) is None
    assert client.post("/api/auth/register", json={
        "username": "alice", "name": "Alice", "email": "alice@example.com",
        "password": "correct-password", "password_confirmation": "correct-password",
    }).status_code == 409
    assert client.post("/api/auth/login", json={"username": "alice", "password": "wrong-password"}).status_code == 401
    response = client.post("/api/auth/login", json={"username": "alice", "password": "correct-password"})
    assert response.status_code == 200
    assert "HttpOnly" in response.headers["set-cookie"]
    assert "SameSite=lax" in response.headers["set-cookie"]
    assert owner.post("/api/auth/logout").status_code == 204
    assert owner.get("/api/auth/me").status_code == 401


def test_expired_session_and_foreign_origin_are_rejected(system, actor):
    client, app, *_ = system
    owner = actor("alice")
    response = client.post("/api/rooms", json={}, headers={**owner.headers, "origin": "https://evil.example"})
    assert response.status_code == 403
    with app.state.database.session() as db:
        session = db.get(Session, digest_token(owner.token))
        session.expires_at = utcnow() - timedelta(seconds=1)
        db.commit()
    assert owner.get("/api/rooms").status_code == 401


def test_room_validation_and_permission(actor):
    owner, outsider = actor("alice"), actor("outsider")
    assert owner.post("/api/rooms", json={"language_a": "vi", "language_b": "vi"}).status_code == 422
    assert owner.post("/api/rooms", json={"language_a": "xx"}).status_code == 422
    room_id = make_room(owner)
    assert outsider.get(f"/api/rooms/{room_id}").status_code == 404
    assert outsider.get(f"/api/rooms/{room_id}/messages").status_code == 404
    assert outsider.post(f"/api/rooms/{room_id}/messages", json={"text": "secret", "client_message_id": "outside-1", "speaker": "A"}).status_code == 404
    assert outsider.delete(f"/api/rooms/{room_id}").status_code == 404
    with pytest.raises(WebSocketDisconnect):
        with outsider.socket(room_id):
            pass
    with pytest.raises(WebSocketDisconnect):
        with owner.client.websocket_connect(f"/ws/rooms/{room_id}", headers={"cookie": f"{COOKIE_NAME}={owner.token}", "origin": "https://evil.example"}):
            pass


def test_shared_translation_both_directions_and_idempotency(system, actor):
    _, _, translator, _ = system
    owner = actor("alice")
    room_id = make_room(owner)
    payload = {"text": "Xin chào", "speaker": "A", "client_message_id": "stable-message-a"}
    first = owner.post(f"/api/rooms/{room_id}/messages", json=payload).json()
    duplicate = owner.post(f"/api/rooms/{room_id}/messages", json=payload).json()
    assert first["id"] == duplicate["id"]
    assert wait_message(owner, room_id, "translated")["translation"] == "Hello"
    assert owner.post(f"/api/rooms/{room_id}/messages", json={**payload, "text": "changed"}).status_code == 409
    assert owner.post(f"/api/rooms/{room_id}/messages", json={**payload, "speaker": "B"}).status_code == 409
    owner.post(f"/api/rooms/{room_id}/messages", json={"text": "How are you?", "speaker": "B", "client_message_id": "stable-message-b"})
    translated = wait_message(owner, room_id, "translated", count=2)
    assert translated["translation"] == "Bạn khỏe không?"
    assert translator.calls == [("Xin chào", "vi", "en"), ("How are you?", "en", "vi")]


def test_failure_preserves_source_and_retry_updates_same_message(system, actor):
    _, _, translator, _ = system
    owner = actor("alice")
    room_id = make_room(owner)
    translator.fail = True
    owner.post(f"/api/rooms/{room_id}/messages", json={"text": "Xin chào", "speaker": "A", "client_message_id": "failed-message"})
    failed = wait_message(owner, room_id, "error")
    assert failed["text"] == "Xin chào" and failed["error_code"] == "timeout"
    translator.fail = False
    assert owner.post(f"/api/rooms/{room_id}/messages/{failed['id']}/retry").status_code == 200
    translated = wait_message(owner, room_id, "translated")
    assert translated["id"] == failed["id"]
    assert translated["version"] > failed["version"]


def test_invite_is_single_use_and_role_is_enforced(system, actor):
    owner, guest, third = actor("alice"), actor("bobby"), actor("third")
    room_id = make_room(owner, "remote")
    token = join(owner, guest, room_id)
    assert guest.get(f"/api/rooms/{room_id}").json()["side"] == "B"
    assert third.post("/api/rooms/join", json={"token": token}).status_code == 404
    assert owner.post(f"/api/rooms/{room_id}/invite").status_code == 409
    assert guest.post(f"/api/rooms/{room_id}/invite").status_code == 403
    assert guest.delete(f"/api/rooms/{room_id}").status_code == 403
    payload = {"text": "Hello", "client_message_id": "guest-message", "speaker": "A"}
    assert guest.post(f"/api/rooms/{room_id}/messages", json=payload).status_code == 403
    assert guest.post(f"/api/rooms/{room_id}/messages", json={**payload, "speaker": "B"}).status_code == 201


def test_simultaneous_joins_never_create_a_third_member(system, actor):
    _, app, *_ = system
    owner, guest, third = actor("alice"), actor("bobby"), actor("third")
    room_id = make_room(owner, "remote")
    token = owner.post(f"/api/rooms/{room_id}/invite").json()["token"]
    with ThreadPoolExecutor(2) as pool:
        responses = list(pool.map(lambda user: user.post("/api/rooms/join", json={"token": token}), [guest, third]))
    assert sorted(response.status_code for response in responses) in ([200, 404], [200, 409])
    with app.state.database.session() as db:
        assert db.scalar(select(func.count()).select_from(Membership).where(Membership.room_id == room_id)) == 2


def test_websocket_broadcast_and_reconnect_resync(system, actor):
    _, _, translator, _ = system
    owner, guest = actor("alice"), actor("bobby")
    room_id = make_room(owner, "remote")
    join(owner, guest, room_id)
    with owner.socket(room_id) as a, guest.socket(room_id) as b:
        assert a.receive_json()["type"] == "room.snapshot"
        assert b.receive_json()["type"] == "room.snapshot"
        a.send_json({"type": "text.submit", "text": "Xin chào", "client_message_id": "socket-message"})
        first = b.receive_json()
        assert first["type"] == "message.upsert"
        final = b.receive_json()
        assert final["message"]["translation"] == "Hello"
        sequence = final["message"]["sequence"]
    # A translation can finish while the viewer is disconnected.
    translator.fail = True
    owner.post(f"/api/rooms/{room_id}/messages", json={"text": "Next", "client_message_id": "socket-next"})
    wait_message(owner, room_id, "error")
    with guest.socket(room_id, f"?from_sequence={sequence}") as socket:
        snapshot = socket.receive_json()
        assert len(snapshot["messages"]) == 2
        assert snapshot["messages"][-1]["status"] == "error"


def test_logout_revokes_open_websocket(actor):
    owner = actor("alice")
    room_id = make_room(owner)
    with owner.socket(room_id) as socket:
        socket.receive_json()
        owner.post("/api/auth/logout")
        with pytest.raises(WebSocketDisconnect) as closed:
            socket.receive_json()
        assert closed.value.code == 4401


def test_audio_capture_lease_and_no_permission_leak(actor):
    owner = actor("alice")
    room_id = make_room(owner)
    with owner.socket(room_id) as first, owner.socket(room_id) as second:
        first.receive_json()
        second.receive_json()
        first.send_json({"type": "audio.start"})
        assert first.receive_json() == {"type": "audio.state", "recording": True}
        assert second.receive_json() == {"type": "room.presence", "members": [
            {"side": "A", "online": True, "recording": True},
            {"side": "B", "online": False, "recording": False},
        ]}
        second.send_json({"type": "audio.start"})
        assert second.receive_json()["code"] == "capture_in_use"
        first.send_json({"type": "audio.stop"})
        assert first.receive_json()["recording"] is False
        assert second.receive_json() == {"type": "room.presence", "members": [
            {"side": "A", "online": True, "recording": False},
            {"side": "B", "online": False, "recording": False},
        ]}
        second.send_json({"type": "audio.start"})
        assert second.receive_json()["recording"] is True
        assert first.receive_json() == {"type": "room.presence", "members": [
            {"side": "A", "online": True, "recording": True},
            {"side": "B", "online": False, "recording": False},
        ]}


def test_pagination_and_delete_cascade(system, actor):
    _, app, *_ = system
    owner, guest = actor("alice"), actor("bobby")
    room_id = make_room(owner, "remote")
    join(owner, guest, room_id)
    for index in range(4):
        owner.post(f"/api/rooms/{room_id}/messages", json={"text": f"Sentence {index}", "client_message_id": f"page-message-{index}"})
    page = guest.get(f"/api/rooms/{room_id}/messages?limit=2").json()
    assert page["has_more"] and len(page["messages"]) == 2
    previous = guest.get(f"/api/rooms/{room_id}/messages?before={page['messages'][0]['sequence']}&limit=2").json()
    assert not previous["has_more"] and previous["messages"][0]["text"] == "Sentence 0"
    assert len(guest.get("/api/rooms").json()) == 1
    assert owner.delete(f"/api/rooms/{room_id}").status_code == 204
    assert guest.get("/api/rooms").json() == []
    with app.state.database.session() as db:
        assert db.scalar(select(func.count()).select_from(Message)) == 0
        assert db.scalar(select(func.count()).select_from(Membership)) == 0


def test_missing_credentials_cannot_open_socket(system, actor):
    client, *_ = system
    owner = actor("alice")
    room_id = make_room(owner)
    outsider = Actor(client, {}, "invalid-cookie")
    with pytest.raises(WebSocketDisconnect):
        with outsider.socket(room_id):
            pass


def test_unknown_voice_waits_for_speaker_before_translation(system, actor):
    client, app, translator, _ = system
    owner = actor("alice")
    room_id = make_room(owner)
    message = client.portal.call(app.state.messages.submit, room_id, owner.user["id"],
                                 "Hello", "uncertain-voice", None, "voice")
    assert message["status"] == "needs_speaker"
    assert translator.calls == []
    response = owner.post(f"/api/rooms/{room_id}/messages/{message['id']}/speaker", json={"speaker": "B"})
    assert response.status_code == 200
    translated = wait_message(owner, room_id, "translated")
    assert translated["source_language"] == "en"
    assert translated["translation"] == "Xin chào"
