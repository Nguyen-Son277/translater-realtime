import asyncio
from dataclasses import dataclass, field

from anyio import BrokenResourceError, ClosedResourceError
from fastapi import WebSocket, WebSocketDisconnect

DISCONNECTED = (RuntimeError, OSError, WebSocketDisconnect, BrokenResourceError, ClosedResourceError)


@dataclass(eq=False)
class Connection:
    websocket: WebSocket
    user_id: str
    room_id: str
    side: str
    session_digest: str
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)

    async def send(self, payload):
        async with self.lock:
            await self.websocket.send_json(payload)

    async def close(self, code=1000):
        async with self.lock:
            await self.websocket.close(code=code)


class Hub:
    def __init__(self):
        self.rooms: dict[str, set[Connection]] = {}
        self.captures: dict[tuple[str, str], Connection] = {}

    def add(self, connection):
        self.rooms.setdefault(connection.room_id, set()).add(connection)

    def remove(self, connection):
        connections = self.rooms.get(connection.room_id)
        if connections:
            connections.discard(connection)
            if not connections:
                self.rooms.pop(connection.room_id, None)
        self.release_capture(connection)

    async def broadcast(self, room_id, payload):
        connections = tuple(self.rooms.get(room_id, ()))
        results = await asyncio.gather(*(c.send(payload) for c in connections), return_exceptions=True)
        for connection, result in zip(connections, results, strict=True):
            if isinstance(result, Exception):
                self.remove(connection)

    def acquire_capture(self, connection, mode):
        key = (connection.room_id, "shared" if mode == "shared" else connection.side)
        current = self.captures.get(key)
        if current and current is not connection:
            return False
        self.captures[key] = connection
        return True

    def release_capture(self, connection):
        for key, value in tuple(self.captures.items()):
            if value is connection:
                self.captures.pop(key, None)

    async def close_session(self, session_digest):
        connections = [c for room in self.rooms.values() for c in room if c.session_digest == session_digest]
        for connection in connections:
            self.remove(connection)
            try:
                await connection.close(4401)
            except DISCONNECTED:
                pass

    async def close_room(self, room_id):
        for connection in tuple(self.rooms.get(room_id, ())):
            self.remove(connection)
            try:
                await connection.close()
            except DISCONNECTED:
                pass
