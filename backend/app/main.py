import asyncio
import json
import logging
import secrets
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from datetime import timedelta
from time import monotonic

from anyio import CancelScope
from fastapi import (
    Depends,
    FastAPI,
    HTTPException,
    Query,
    Request,
    Response,
    WebSocket,
)
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from sqlalchemy import delete, select, update
from sqlalchemy.exc import IntegrityError

from app.auth import (
    COOKIE_NAME,
    create_session,
    current_user,
    digest_token,
    find_user,
    origin_allowed,
    passwords,
    require_room,
    room_dict,
    user_dict,
    verify_password,
)
from app.config import LANGUAGES, WS_PING_INTERVAL, WS_PONG_DEADLINE, Settings
from app.db import Database
from app.hub import DISCONNECTED, Connection, Hub
from app.models import Membership, Message, Room, Session, User, utcnow
from app.schemas import (
    AssignSpeaker,
    Credentials,
    EmailUpdate,
    JoinRoom,
    Registration,
    RoomCreate,
    TextMessage,
)
from app.services import MessageService
from app.speech import AudioStream, create_recognizer
from app.translation import LocalTranslator, TranslationJobs

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")


def create_app(settings=None, recognizer=None, translator=None):
    settings = settings or Settings()
    settings.prepare_directories()
    database = Database(settings.database_url)
    hub = Hub()
    recognizer = recognizer or create_recognizer(settings)
    translator = translator or LocalTranslator(settings)
    jobs = TranslationJobs(database, hub, translator, settings)
    messages = MessageService(database, hub, jobs)
    attempts = defaultdict(deque)

    @asynccontextmanager
    async def lifespan(app):
        database.migrate()
        with database.session() as db:
            db.execute(delete(Session).where(Session.expires_at < utcnow()))
            db.execute(update(Message).where(Message.status == "pending").values(
                status="error", error_code="interrupted", version=Message.version + 1,
                updated_at=utcnow(),
            ))
            db.commit()
        await recognizer.start()
        yield
        for room_id in tuple(hub.rooms):
            await hub.close_room(room_id)
        await hub.close_drains()
        await jobs.close()
        await recognizer.close()
        database.engine.dispose()

    app = FastAPI(title="Song Ngữ API", version="1.0.0", lifespan=lifespan)
    app.state.database = database
    app.state.settings = settings
    app.state.recognizer = recognizer
    app.state.translator = translator
    app.state.hub = hub
    app.state.messages = messages

    @app.middleware("http")
    async def same_origin(request: Request, call_next):
        if request.method not in {"GET", "HEAD", "OPTIONS"} and not origin_allowed(
            request.headers.get("origin"), request.headers.get("host", ""), settings.trusted_origins,
        ):
            return JSONResponse({"detail": "Nguồn yêu cầu không được phép."}, status_code=403)
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "same-origin"
        response.headers["Cache-Control"] = "no-store"
        return response

    def auth_rate_limit(request):
        key = request.client.host if request.client else "local"
        now = monotonic()
        bucket = attempts[key]
        while bucket and bucket[0] < now - 60:
            bucket.popleft()
        limit = getattr(settings, "auth_rate_limit", 60)
        if len(bucket) >= limit:
            raise HTTPException(429, "Bạn đã thử nhiều lần. Vui lòng đợi một phút.")
        bucket.append(now)
        if len(attempts) > 10000:
            for address in list(attempts):
                if not attempts[address] or attempts[address][-1] < now - 60:
                    attempts.pop(address, None)

    @app.get("/health/live")
    def live():
        return {"status": "ok"}

    @app.get("/health/ready")
    def ready():
        ok = not settings.speech_enabled or recognizer.state == "ready"
        return JSONResponse({"status": "ready" if ok else "warming_up", "speech": recognizer.state},
                            status_code=200 if ok else 503)

    @app.get("/api/config")
    def config(user=Depends(current_user)):
        return {"languages": LANGUAGES, "speech": recognizer.state,
                "translation_configured": translator.configured}

    @app.post("/api/auth/register", status_code=201)
    async def register(body: Registration, request: Request, response: Response):
        auth_rate_limit(request)
        hashed = await asyncio.to_thread(passwords.hash, body.password)
        with database.session() as db:
            user = User(username=body.username, name=body.name, email=body.email, password_hash=hashed)
            db.add(user)
            try:
                db.flush()
                create_session(db, user.id, settings, response)
                db.commit()
            except IntegrityError as exc:
                raise HTTPException(409, "Tên đăng nhập hoặc email đã được sử dụng.") from exc
            return user_dict(user)

    @app.post("/api/auth/login")
    async def login(body: Credentials, request: Request, response: Response):
        auth_rate_limit(request)
        with database.session() as db:
            user = db.scalar(select(User).where(User.username == body.username))
            # Always verify a real hash to keep the unknown-user path comparable.
            if not user:
                await asyncio.to_thread(passwords.hash, body.password)
                raise HTTPException(401, "Tên đăng nhập hoặc mật khẩu chưa đúng.")
            if not await asyncio.to_thread(verify_password, body.password, user.password_hash):
                raise HTTPException(401, "Tên đăng nhập hoặc mật khẩu chưa đúng.")
            create_session(db, user.id, settings, response)
            db.commit()
            return user_dict(user)

    @app.get("/api/auth/me")
    def me(user=Depends(current_user)):
        return user_dict(user)

    @app.patch("/api/auth/me")
    def update_email(body: EmailUpdate, user=Depends(current_user)):
        with database.session() as db:
            account = db.get(User, user.id)
            if account is None:
                raise HTTPException(401, "Vui lòng đăng nhập để tiếp tục.")
            account.email = body.email
            try:
                db.commit()
            except IntegrityError as exc:
                raise HTTPException(409, "Email đã được sử dụng.") from exc
            return user_dict(account)

    @app.post("/api/auth/logout", status_code=204)
    async def logout(request: Request, response: Response):
        token = request.cookies.get(COOKIE_NAME)
        if token:
            digest = digest_token(token)
            with database.session() as db:
                db.execute(delete(Session).where(Session.digest == digest))
                db.commit()
            await hub.close_session(digest)
        response.delete_cookie(COOKIE_NAME, path="/", secure=settings.cookie_secure,
                               httponly=True, samesite="lax")

    @app.get("/api/rooms")
    def list_rooms(user=Depends(current_user)):
        with database.session() as db:
            rows = db.execute(select(Room, Membership).join(
                Membership, Membership.room_id == Room.id,
            ).where(Membership.user_id == user.id).order_by(Room.updated_at.desc())).all()
            return [room_dict(db, room, member) for room, member in rows]

    @app.post("/api/rooms", status_code=201)
    def create_room(body: RoomCreate, user=Depends(current_user)):
        with database.session() as db:
            room = Room(owner_id=user.id, title=body.title.strip() or "Cuộc trò chuyện mới",
                        mode=body.mode, language_a=body.language_a, language_b=body.language_b)
            db.add(room)
            db.flush()
            member = Membership(room_id=room.id, user_id=user.id, side="A")
            db.add(member)
            db.commit()
            return room_dict(db, room, member)

    @app.post("/api/rooms/join")
    async def join_room(body: JoinRoom, user=Depends(current_user)):
        with database.session() as db:
            room = db.scalar(select(Room).where(Room.invite_digest == digest_token(body.token)))
            if not room or room.mode != "remote" or room.invite_expires_at < utcnow():
                raise HTTPException(404, "Lời mời không hợp lệ hoặc đã hết hạn. Hãy xin liên kết mới.")
            member = db.scalar(select(Membership).where(
                Membership.room_id == room.id, Membership.user_id == user.id,
            ))
            if member:
                return room_dict(db, room, member)
            member = Membership(room_id=room.id, user_id=user.id, side="B")
            db.add(member)
            room.invite_digest = None
            room.invite_expires_at = None
            try:
                db.commit()
            except IntegrityError as exc:
                raise HTTPException(409, "Phòng đã có đủ hai người.") from exc
            result = room_dict(db, room, member)
        await hub.broadcast(room.id, {"type": "room.members", "members": result["members"]})
        return result

    @app.get("/api/rooms/{room_id}")
    def get_room(room_id: str, user=Depends(current_user)):
        with database.session() as db:
            room, member = require_room(db, room_id, user.id)
            return room_dict(db, room, member)

    @app.post("/api/rooms/{room_id}/invite")
    def invite(room_id: str, user=Depends(current_user)):
        with database.session() as db:
            room, _ = require_room(db, room_id, user.id)
            if room.owner_id != user.id or room.mode != "remote":
                raise HTTPException(403, "Chỉ chủ phòng hai điện thoại có thể tạo lời mời.")
            if db.scalar(select(Membership).where(Membership.room_id == room_id, Membership.side == "B")):
                raise HTTPException(409, "Phòng đã có đủ hai người.")
            token = secrets.token_urlsafe(32)
            room.invite_digest = digest_token(token)
            room.invite_expires_at = utcnow() + timedelta(hours=24)
            db.commit()
            return {"token": token, "expires_at": room.invite_expires_at.isoformat() + "Z"}

    @app.delete("/api/rooms/{room_id}", status_code=204)
    async def delete_room(room_id: str, user=Depends(current_user)):
        with database.session() as db:
            room, _ = require_room(db, room_id, user.id)
            if room.owner_id != user.id:
                raise HTTPException(403, "Chỉ chủ phòng được xóa cuộc hội thoại.")
            db.delete(room)
            db.commit()
        await hub.broadcast(room_id, {"type": "room.deleted"})
        await hub.close_room(room_id)

    @app.get("/api/rooms/{room_id}/messages")
    def get_messages(room_id: str, before: int | None = Query(default=None, ge=1),
                     limit: int = Query(default=50, ge=1, le=100), user=Depends(current_user)):
        return messages.snapshot(room_id, user.id, before, limit)

    @app.post("/api/rooms/{room_id}/messages", status_code=201)
    async def submit_message(room_id: str, body: TextMessage, user=Depends(current_user)):
        return await messages.submit(room_id, user.id, body.text, body.client_message_id, body.speaker)

    @app.post("/api/rooms/{room_id}/messages/{message_id}/retry")
    async def retry_message(room_id: str, message_id: str, user=Depends(current_user)):
        return await messages.retry(room_id, message_id, user.id)

    @app.post("/api/rooms/{room_id}/messages/{message_id}/speaker")
    async def assign_speaker(room_id: str, message_id: str, body: AssignSpeaker, user=Depends(current_user)):
        return await messages.retry(room_id, message_id, user.id, speaker=body.speaker)

    @app.websocket("/ws/rooms/{room_id}")
    async def room_socket(websocket: WebSocket, room_id: str):
        if not origin_allowed(websocket.headers.get("origin"), websocket.headers.get("host", ""),
                              settings.trusted_origins):
            await websocket.close(4403)
            return
        token = websocket.cookies.get(COOKIE_NAME)
        user = find_user(database, token)
        if not user:
            await websocket.close(4401)
            return
        try:
            with database.session() as db:
                room, member = require_room(db, room_id, user.id)
                room_payload = room_dict(db, room, member)
        except HTTPException:
            await websocket.close(4404)
            return
        await websocket.accept()
        presence_before = hub.presence(room_id)
        connection = Connection(websocket, user.id, room_id, member.side, digest_token(token))
        hub.add(connection)
        presence_after = hub.presence(room_id)
        if presence_after != presence_before:
            await hub.broadcast_presence(room_id, exclude=connection)
        stream = None
        last_pong = monotonic()
        ping_interval = getattr(settings, "ws_ping_interval", WS_PING_INTERVAL)
        pong_deadline = getattr(settings, "ws_pong_deadline", WS_PONG_DEADLINE)

        async def heartbeat():
            nonlocal last_pong
            try:
                while True:
                    await asyncio.sleep(ping_interval)
                    now = monotonic()
                    if now - last_pong >= pong_deadline or connection not in hub.rooms.get(room_id, ()):
                        hub.remove(connection)
                        await hub.broadcast_presence(room_id)
                        await connection.close(1000)
                        return
                    if not find_user(database, token):
                        await connection.close(4401)
                        return
                    await connection.send({"type": "ping"})
            except DISCONNECTED:
                hub.remove(connection)
                await hub.broadcast_presence(room_id)
                try:
                    await connection.close(1000)
                except DISCONNECTED:
                    pass
            except asyncio.CancelledError:
                pass

        heartbeat_task = asyncio.create_task(heartbeat())

        async def on_final(segment_id, text, speaker):
            await messages.submit(room_id, user.id, text, f"audio:{segment_id}", speaker, "voice")

        try:
            with database.session() as db:
                current_room, current_member = require_room(db, room_id, user.id)
                room_payload = room_dict(db, current_room, current_member)
            from_sequence = websocket.query_params.get("from_sequence")
            if from_sequence and from_sequence.isdigit() and int(from_sequence) > 0:
                snapshot = messages.snapshot_loaded(room_id, user.id, int(from_sequence))
                with database.session() as db:
                    has_more = db.scalar(select(Message.sequence).where(
                        Message.room_id == room_id, Message.sequence < int(from_sequence),
                    ).limit(1)) is not None
            else:
                page = messages.snapshot(room_id, user.id)
                snapshot, has_more = page["messages"], page["has_more"]
            await connection.send({"type": "room.snapshot", "room": room_payload,
                                   "messages": snapshot, "has_more": has_more,
                                   "presence": hub.presence(room_id)})
            while connection in hub.rooms.get(room_id, ()):
                try:
                    packet = await asyncio.wait_for(websocket.receive(), timeout=pong_deadline + 5)
                except TimeoutError:
                    if not find_user(database, token):
                        await connection.close(4401)
                        break
                    continue
                if packet["type"] == "websocket.disconnect" or connection not in hub.rooms.get(room_id, ()):
                    break
                if not find_user(database, token):
                    await connection.close(4401)
                    break
                if packet.get("bytes") is not None:
                    data = packet["bytes"]
                    if not stream:
                        await connection.send({"type": "error", "code": "audio_not_started",
                                               "detail": "Hãy bắt đầu micro trước khi gửi âm thanh."})
                    elif len(data) > 32000 or len(data) % 2:
                        correlated = {"capture_id": stream.capture_id} if stream and stream.capture_id is not None else {}
                        await connection.send({"type": "error", "code": "invalid_audio",
                                               "detail": "Gói âm thanh không hợp lệ.", **correlated})
                        await connection.close(4400)
                        break
                    else:
                        try:
                            stream.feed(data)
                        except OverflowError:
                            correlated = {"capture_id": stream.capture_id} if stream and stream.capture_id is not None else {}
                            await connection.send({"type": "error", "code": "audio_queue_full",
                                                   "detail": "Nhận giọng nói đang quá tải. Hãy tạm dừng rồi thử lại.", **correlated})
                            active_stream = stream
                            stream = None
                            hub.drain_capture(connection, room.mode, active_stream, flush=False)
                            hub.release_capture(connection, capture_id=active_stream.capture_id)
                            await connection.send({"type": "audio.state", "recording": False, **correlated})
                            await hub.broadcast_presence(room.id, exclude=connection)
                    continue
                try:
                    if len(packet.get("text", "")) > 20000:
                        raise ValueError("oversized_packet")
                    event = json.loads(packet.get("text", "{}"))
                    if not isinstance(event, dict):
                        raise ValueError("invalid_packet")
                    kind = event.get("type")
                    if kind == "pong":
                        last_pong = monotonic()
                        continue
                    if kind in {"audio.start", "audio.stop"}:
                        capture_id = event.get("capture_id")
                        if capture_id is not None and (not isinstance(capture_id, str) or not 1 <= len(capture_id) <= 128):
                            raise ValueError("invalid_capture_id")
                    if kind == "audio.start":
                        capture_id = event.get("capture_id")
                        correlated = {"capture_id": capture_id} if capture_id is not None else {}
                        if stream:
                            if capture_id is not None and stream.capture_id != capture_id:
                                await connection.send({"type": "error", "code": "capture_busy",
                                                       "detail": "Phiên micro trước vẫn đang mở. Hãy dừng trước khi mở phiên mới.", **correlated})
                            else:
                                await connection.send({"type": "audio.state", "recording": True, **correlated})
                            continue
                        if recognizer.state != "ready":
                            await connection.send({"type": "error", "code": "speech_unavailable",
                                                   "detail": "Nhận giọng nói chưa sẵn sàng. Bạn có thể nhập chữ.", **correlated})
                            continue
                        if not hub.can_start_capture(connection, room.mode):
                            await connection.send({"type": "error", "code": "capture_busy",
                                                   "detail": "Đang xử lý các đoạn nói trước. Chờ một chút rồi bấm bắt đầu lại.", **correlated})
                            continue
                        if not hub.acquire_capture(connection, room.mode, capture_id=capture_id):
                            await connection.send({"type": "error", "code": "capture_in_use",
                                                   "detail": "Micro đang được sử dụng trong một cửa sổ khác.", **correlated})
                            continue
                        stream = AudioStream(recognizer, connection, room, settings, hub, on_final, capture_id=capture_id)
                        await connection.send({"type": "audio.state", "recording": True, **correlated})
                        await hub.broadcast_presence(room.id, exclude=connection)
                    elif kind == "audio.stop":
                        capture_id = event.get("capture_id")
                        correlated = {"capture_id": capture_id} if capture_id is not None else {}
                        if stream:
                            if capture_id is not None and capture_id != stream.capture_id:
                                pass
                            else:
                                active_stream = stream
                                stream = None
                                hub.drain_capture(connection, room.mode, active_stream, flush=True)
                                hub.release_capture(connection, capture_id=active_stream.capture_id)
                                await connection.send({"type": "audio.state", "recording": False, **correlated})
                                await hub.broadcast_presence(room.id, exclude=connection)
                        else:
                            await connection.send({"type": "audio.state", "recording": False, **correlated})
                    elif kind == "text.submit":
                        body = TextMessage.model_validate(event)
                        result = await messages.submit(room_id, user.id, body.text,
                                                       body.client_message_id, body.speaker)
                        await connection.send({"type": "message.ack", "message": result})
                    else:
                        await connection.send({"type": "error", "code": "invalid_event",
                                               "detail": "Sự kiện không được hỗ trợ."})
                except (ValueError, ValidationError):
                    await connection.send({"type": "error", "code": "invalid_event",
                                           "detail": "Dữ liệu gửi lên không hợp lệ."})
                except HTTPException as exc:
                    await connection.send({"type": "error", "code": "request_failed", "detail": exc.detail})
        except DISCONNECTED:
            pass
        finally:
            hub.remove(connection)
            with CancelScope(shield=True):
                heartbeat_task.cancel()
                await asyncio.gather(heartbeat_task, return_exceptions=True)
                if stream:
                    hub.drain_capture(connection, room.mode, stream, flush=False)
                await hub.broadcast_presence(room_id)

    return app


app = create_app()
