from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.auth import require_room
from app.models import Message, message_dict, utcnow


def languages_for(room, speaker):
    if speaker == "A":
        return room.language_a, room.language_b
    if speaker == "B":
        return room.language_b, room.language_a
    return None, None


class MessageService:
    def __init__(self, database, hub, jobs):
        self.database, self.hub, self.jobs = database, hub, jobs

    async def submit(self, room_id, user_id, text, client_message_id, speaker=None, source="text"):
        with self.database.session() as db:
            room, member = require_room(db, room_id, user_id)
            if room.mode == "remote":
                if speaker and speaker != member.side:
                    raise HTTPException(403, "Bạn chỉ có thể gửi lời của mình.")
                speaker = member.side
            elif source == "text" and speaker not in {"A", "B"}:
                raise HTTPException(422, "Vui lòng chọn người A hoặc B.")
            existing = db.scalar(select(Message).where(
                Message.room_id == room_id, Message.author_id == user_id,
                Message.client_message_id == client_message_id,
            ))
            if existing:
                if (existing.text != text or existing.source != source
                        or (source == "text" and existing.speaker != speaker)):
                    raise HTTPException(409, "Mã câu đã được sử dụng cho nội dung khác.")
                return message_dict(existing)
            language, target = languages_for(room, speaker)
            message = Message(
                room_id=room_id, author_id=user_id, client_message_id=client_message_id,
                text=text, speaker=speaker, source=source, source_language=language,
                target_language=target, status="pending" if speaker else "needs_speaker",
            )
            db.add(message)
            room.updated_at = utcnow()
            try:
                db.commit()
            except IntegrityError:
                db.rollback()
                existing = db.scalar(select(Message).where(
                    Message.room_id == room_id, Message.author_id == user_id,
                    Message.client_message_id == client_message_id,
                ))
                if not existing:
                    raise
                return message_dict(existing)
            result = message_dict(message)
        await self.hub.broadcast(room_id, {"type": "message.upsert", "message": result})
        if result["status"] == "pending":
            await self.jobs.enqueue(result["id"])
        return result

    async def retry(self, room_id, message_id, user_id, speaker=None):
        with self.database.session() as db:
            room, _ = require_room(db, room_id, user_id)
            message = db.scalar(select(Message).where(Message.id == message_id, Message.room_id == room_id))
            if not message:
                raise HTTPException(404, "Không tìm thấy câu hội thoại.")
            if speaker:
                if room.mode != "shared" or message.status != "needs_speaker":
                    raise HTTPException(409, "Câu này đã xác định người nói.")
                if user_id != message.author_id:
                    raise HTTPException(403, "Bạn không thể thay đổi câu này.")
                message.speaker = speaker
                message.source_language, message.target_language = languages_for(room, speaker)
            elif message.status != "error":
                return message_dict(message)
            message.status, message.error_code = "pending", None
            message.version += 1
            message.updated_at = utcnow()
            db.commit()
            result = message_dict(message)
        await self.hub.broadcast(room_id, {"type": "message.upsert", "message": result})
        await self.jobs.enqueue(message_id)
        return result

    def snapshot(self, room_id, user_id, before=None, limit=50):
        with self.database.session() as db:
            require_room(db, room_id, user_id)
            query = select(Message).where(Message.room_id == room_id)
            if before:
                query = query.where(Message.sequence < before)
            messages = db.scalars(query.order_by(Message.sequence.desc()).limit(limit + 1)).all()
            has_more = len(messages) > limit
            page = list(reversed(messages[:limit]))
            return {"messages": [message_dict(message) for message in page], "has_more": has_more}

    def snapshot_loaded(self, room_id, user_id, from_sequence=None):
        """Resync all already loaded messages, including edits to old pending translations."""
        with self.database.session() as db:
            require_room(db, room_id, user_id)
            query = select(Message).where(Message.room_id == room_id)
            if from_sequence is not None:
                query = query.where(Message.sequence >= from_sequence)
                return [message_dict(m) for m in db.scalars(query.order_by(Message.sequence)).all()]
            return self.snapshot(room_id, user_id)["messages"]
