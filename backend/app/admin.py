import asyncio
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func, or_, select

from app.auth import (
    admin_account_dict,
    current_admin,
    is_admin,
    passwords,
    revoke_sessions,
)
from app.models import Membership, Room, Session, User, utcnow
from app.schemas import AccountStatusUpdate, AdminPasswordReset

PAGE_SIZE_DEFAULT = 25
PAGE_SIZE_MAX = 100


def account_counts(db, user_ids):
    if not user_ids:
        return {}, {}
    sessions = dict(db.execute(
        select(Session.user_id, func.count()).where(
            Session.user_id.in_(user_ids), Session.expires_at > utcnow(),
        )
        .group_by(Session.user_id),
    ).all())
    rooms = dict(db.execute(
        select(Membership.user_id, func.count()).where(Membership.user_id.in_(user_ids))
        .group_by(Membership.user_id),
    ).all())
    return sessions, rooms


def account_dict(db, user, settings):
    sessions, rooms = account_counts(db, [user.id])
    return admin_account_dict(user, settings, sessions.get(user.id, 0), rooms.get(user.id, 0))


def create_admin_router(settings, database, hub, rate_limit):
    router = APIRouter(prefix="/api/admin", tags=["admin"])

    def require_target(db, user_id: str) -> User:
        user = db.get(User, user_id)
        if user is None:
            raise HTTPException(404, "Không tìm thấy tài khoản.")
        return user

    def reject_admin_target(user: User) -> None:
        if is_admin(user, settings):
            raise HTTPException(403, "Không thể thao tác trên tài khoản quản trị.")

    @router.get("/accounts")
    def list_accounts(query: str = Query(default="", max_length=100),
                      role: Literal["all", "admin", "user", "guest"] = "all",
                      status: Literal["all", "active", "locked"] = "all",
                      page: int = Query(default=1, ge=1),
                      page_size: int = Query(default=PAGE_SIZE_DEFAULT, ge=1, le=PAGE_SIZE_MAX),
                      admin=Depends(current_admin)):
        with database.session() as db:
            statement = select(User).order_by(User.created_at.desc(), User.username)
            needle = query.strip().lower()
            if needle:
                escaped = needle.replace("\\", "\\\\").replace("%", r"\%").replace("_", r"\_")
                pattern = f"%{escaped}%"
                statement = statement.where(or_(
                    func.lower(User.username).like(pattern, escape="\\"),
                    func.lower(User.name).like(pattern, escape="\\"),
                    func.lower(User.email).like(pattern, escape="\\"),
                ))
            if status == "active":
                statement = statement.where(User.is_active.is_(True))
            elif status == "locked":
                statement = statement.where(User.is_active.is_(False))
            users = list(db.scalars(statement))
            if role != "all":
                users = [user for user in users if _matches_role(user, settings, role)]
            total = len(users)
            start = (page - 1) * page_size
            window = users[start:start + page_size]
            sessions, rooms = account_counts(db, [user.id for user in window])
            return {
                "items": [admin_account_dict(user, settings, sessions.get(user.id, 0),
                                             rooms.get(user.id, 0)) for user in window],
                "total": total, "page": page, "page_size": page_size,
            }

    @router.patch("/accounts/{user_id}")
    async def update_account(user_id: str, body: AccountStatusUpdate, request: Request,
                             admin=Depends(current_admin)):
        rate_limit(request)
        with database.session() as db:
            user = require_target(db, user_id)
            reject_admin_target(user)
            user.is_active = body.is_active
            if not body.is_active:
                revoke_sessions(db, user.id)
            db.commit()
            result = account_dict(db, user, settings)
        if not body.is_active:
            await hub.close_user(user_id)
        return result

    @router.post("/accounts/{user_id}/password")
    async def reset_password(user_id: str, body: AdminPasswordReset, request: Request,
                             admin=Depends(current_admin)):
        rate_limit(request)
        with database.session() as db:
            user = require_target(db, user_id)
            reject_admin_target(user)
            if user.is_guest:
                raise HTTPException(409, "Tài khoản khách không có mật khẩu.")
            hashed = await asyncio.to_thread(passwords.hash, body.new_password)
            user.password_hash = hashed
            user.must_change_password = True
            revoke_sessions(db, user.id)
            db.commit()
            result = account_dict(db, user, settings)
        await hub.close_user(user_id)
        return result

    @router.delete("/accounts/{user_id}", status_code=204)
    async def delete_account(user_id: str, request: Request, admin=Depends(current_admin)):
        rate_limit(request)
        with database.session() as db:
            user = require_target(db, user_id)
            reject_admin_target(user)
            # Deleting an account cascades its memberships. Only rooms owned by
            # the account are deleted; rooms where it was merely a member remain
            # available to their other members and receive an updated roster.
            owned_rooms = set(db.scalars(select(Room.id).where(Room.owner_id == user.id)))
            member_rooms = set(db.scalars(
                select(Membership.room_id).where(Membership.user_id == user.id),
            ))
            remaining_rooms = member_rooms - owned_rooms
            db.delete(user)
            db.commit()
            # Build payloads after the cascade so the removed member is absent.
            room_members = {}
            for room_id in remaining_rooms:
                rows = db.execute(select(Membership.side, User.username, User.name).join(
                    User, Membership.user_id == User.id,
                ).where(Membership.room_id == room_id)).all()
                room_members[room_id] = [
                    {"side": side, "username": username, "name": name or username}
                    for side, username, name in rows
                ]
        await hub.close_user(user_id)
        for room_id, members in room_members.items():
            await hub.broadcast(room_id, {"type": "room.members", "members": members})
        for room_id in owned_rooms:
            await hub.broadcast(room_id, {"type": "room.deleted"})
            await hub.close_room(room_id)

    return router


def _matches_role(user: User, settings, role: str) -> bool:
    admin = is_admin(user, settings)
    if role == "admin":
        return admin
    if role == "guest":
        return user.is_guest
    return not admin and not user.is_guest
