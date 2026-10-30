import hashlib
import secrets
from datetime import timedelta
from urllib.parse import urlparse

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from fastapi import HTTPException, Request, Response
from sqlalchemy import select

from app.models import Membership, Room, Session, User, utcnow

COOKIE_NAME = "songngu_session"
passwords = PasswordHasher()


def digest_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def origin_allowed(origin: str | None, host: str, trusted: set[str]) -> bool:
    if not origin:
        return True  # CLI clients have no ambient browser credentials.
    parsed = urlparse(origin)
    if parsed.scheme not in {"http", "https"}:
        return False
    if parsed.netloc == host or origin.rstrip("/") in trusted:
        return True
    if parsed.netloc.endswith(".trycloudflare.com"):
        return True
    for pattern in trusted:
        if pattern.startswith("*.") and parsed.netloc.endswith(pattern[1:]):
            return True
    return False


def find_user(database, token: str | None) -> User | None:
    if not token:
        return None
    with database.session() as db:
        session = db.get(Session, digest_token(token))
        if not session or session.expires_at <= utcnow():
            return None
        return db.get(User, session.user_id)


def current_user(request: Request) -> User:
    user = find_user(request.app.state.database, request.cookies.get(COOKIE_NAME))
    if not user:
        raise HTTPException(401, "Vui lòng đăng nhập để tiếp tục.")
    return user


def user_dict(user: User) -> dict:
    return {"id": user.id, "username": user.username,
            "name": user.name or user.username, "email": user.email}


def create_session(db, user_id: str, settings, response: Response) -> None:
    token = secrets.token_urlsafe(32)
    db.add(Session(digest=digest_token(token), user_id=user_id,
                   expires_at=utcnow() + timedelta(days=settings.session_days)))
    response.set_cookie(
        COOKIE_NAME, token, httponly=True, secure=settings.cookie_secure,
        samesite="lax", max_age=settings.session_days * 86400, path="/",
    )


def verify_password(password: str, hashed: str) -> bool:
    try:
        return passwords.verify(hashed, password)
    except (VerificationError, InvalidHashError):
        return False


def require_room(db, room_id: str, user_id: str) -> tuple[Room, Membership]:
    room = db.get(Room, room_id)
    member = db.scalar(select(Membership).where(
        Membership.room_id == room_id, Membership.user_id == user_id,
    ))
    if not room or not member:
        raise HTTPException(404, "Không tìm thấy cuộc hội thoại.")
    return room, member


def room_dict(db, room: Room, member: Membership) -> dict:
    members = db.execute(select(Membership.side, User.username, User.name).join(
        User, Membership.user_id == User.id,
    ).where(Membership.room_id == room.id)).all()
    return {
        "id": room.id, "title": room.title, "mode": room.mode,
        "language_a": room.language_a, "language_b": room.language_b,
        "owner_id": room.owner_id, "side": member.side,
        "members": [{"side": side, "username": username, "name": name or username}
                    for side, username, name in members],
        "created_at": room.created_at.isoformat() + "Z",
        "updated_at": room.updated_at.isoformat() + "Z",
    }
