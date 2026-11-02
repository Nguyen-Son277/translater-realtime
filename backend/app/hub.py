import asyncio
from dataclasses import dataclass, field

from anyio import BrokenResourceError, ClosedResourceError
from fastapi import WebSocket, WebSocketDisconnect

DISCONNECTED = (RuntimeError, OSError, TimeoutError, WebSocketDisconnect, BrokenResourceError, ClosedResourceError)
SEND_TIMEOUT = 5.0


@dataclass(eq=False)
class Connection:
    websocket: WebSocket
    user_id: str
    room_id: str
    side: str
    session_digest: str
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)

    async def send(self, payload):
        async with asyncio.timeout(SEND_TIMEOUT):
            async with self.lock:
                await self.websocket.send_json(payload)

    async def close(self, code=1000):
        async with asyncio.timeout(SEND_TIMEOUT):
            async with self.lock:
                await self.websocket.close(code=code)


class Hub:
    def __init__(self):
        self.rooms: dict[str, set[Connection]] = {}
        self.captures: dict[tuple[str, str], tuple[Connection, str | None]] = {}
        self.drains: dict[tuple[str, str], set[asyncio.Task]] = {}

    def can_start_capture(self, connection, mode):
        key = (connection.room_id, "shared" if mode == "shared" else connection.side)
        # A stopped session may still be finishing ASR. Bound this across reconnects,
        # not just per socket, so repeated start/stop cannot bypass the audio queue.
        return sum(not task.done() for task in self.drains.get(key, ())) < 2

    def drain_capture(self, connection, mode, stream, flush=True):
        key = (connection.room_id, "shared" if mode == "shared" else connection.side)
        stream.detach(flush=flush)
        task = asyncio.create_task(stream.stop(flush=False))
        self.drains.setdefault(key, set()).add(task)

        def finished(done):
            pending = self.drains.get(key)
            if pending is not None:
                pending.discard(done)
                if not pending:
                    self.drains.pop(key, None)
            if not done.cancelled():
                done.exception()  # Retrieve failures; AudioStream logs processing errors.

        task.add_done_callback(finished)

    async def close_drains(self):
        tasks = [task for pending in self.drains.values() for task in pending]
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    def add(self, connection):
        self.rooms.setdefault(connection.room_id, set()).add(connection)

    def remove(self, connection):
        connections = self.rooms.get(connection.room_id)
        if connections:
            connections.discard(connection)
            if not connections:
                self.rooms.pop(connection.room_id, None)
        self.force_release_capture(connection)

    async def broadcast(self, room_id, payload, exclude=None):
        connections = tuple(c for c in self.rooms.get(room_id, ()) if c is not exclude)
        results = await asyncio.gather(*(c.send(payload) for c in connections), return_exceptions=True)
        removed = False
        for connection, result in zip(connections, results, strict=True):
            if isinstance(result, Exception):
                self.remove(connection)
                removed = True
        if removed:
            await self.broadcast_presence(room_id)

    def presence(self, room_id: str) -> list[dict]:
        connections = self.rooms.get(room_id, set())
        online_sides = {c.side for c in connections}
        recording_sides = set()
        for (r_id, _), (conn, _) in self.captures.items():
            if r_id == room_id:
                recording_sides.add(conn.side)
        return [
            {"side": "A", "online": "A" in online_sides, "recording": "A" in recording_sides},
            {"side": "B", "online": "B" in online_sides, "recording": "B" in recording_sides},
        ]

    async def broadcast_presence(self, room_id: str, exclude=None):
        payload = {"type": "room.presence", "members": self.presence(room_id)}
        await self.broadcast(room_id, payload, exclude=exclude)

    def acquire_capture(self, connection, mode, capture_id=None):
        key = (connection.room_id, "shared" if mode == "shared" else connection.side)
        current = self.captures.get(key)
        if current and current[0] is not connection:
            return False
        self.captures[key] = (connection, capture_id)
        return True

    def release_capture(self, connection, capture_id=None):
        released = False
        for key, (conn, cur_id) in tuple(self.captures.items()):
            if conn is connection:
                if capture_id is not None and capture_id != cur_id:
                    continue
                self.captures.pop(key, None)
                released = True
        return released

    def force_release_capture(self, connection):
        released = False
        for key, (conn, _) in tuple(self.captures.items()):
            if conn is connection:
                self.captures.pop(key, None)
                released = True
        return released

    async def close_session(self, session_digest):
        connections = [c for room in self.rooms.values() for c in room if c.session_digest == session_digest]
        for connection in connections:
            self.remove(connection)
            try:
                await connection.close(4401)
            except DISCONNECTED:
                pass

    async def close_user(self, user_id):
        connections = [c for room in self.rooms.values() for c in room if c.user_id == user_id]
        for connection in connections:
            self.remove(connection)
            try:
                await connection.close(4401)
            except DISCONNECTED:
                pass

    async def close_user_except(self, user_id, keep_digest):
        connections = [c for room in self.rooms.values() for c in room
                       if c.user_id == user_id and c.session_digest != keep_digest]
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
