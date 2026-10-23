"""Encryption at rest and outbound endpoint restrictions for user credentials."""
import asyncio
import ipaddress
import os
import socket
from pathlib import Path
from threading import Lock
from urllib.parse import urlsplit

import httpx
from cryptography.fernet import Fernet


def public_address(value):
    address = ipaddress.ip_address(value)
    return address.is_global and not address.is_multicast and not address.is_reserved


def normalize_endpoint(value: str, allow_local: bool = False) -> str:
    value = value.strip().rstrip("/")
    try:
        url = urlsplit(value)
        port = url.port
        if (
            not url.hostname
            or url.username is not None
            or url.password is not None
            or "?" in value
            or "#" in value
            or "\\" in value
            or any(ord(char) <= 32 or ord(char) == 127 for char in value)
            or "/chat/completions" in url.path.lower()
            or url.scheme not in ({"http", "https"} if allow_local else {"https"})
            or port == 0
        ):
            raise ValueError
        host = url.hostname.lower().rstrip(".")
        if not allow_local:
            if host == "localhost" or host.endswith((".localhost", ".local", ".internal")):
                raise ValueError
            try:
                address = ipaddress.ip_address(host)
            except ValueError:
                address = None
            if address is not None and not public_address(host):
                raise ValueError
    except ValueError:
        raise ValueError("URL API không hợp lệ. Dùng HTTPS công khai, không kèm khóa, query hoặc /chat/completions.") from None
    return value


class EndpointTransport(httpx.AsyncBaseTransport):
    """Resolve, validate and pin the connection IP to prevent DNS rebinding."""

    def __init__(self, allow_local=False):
        self.allow_local = allow_local
        self.transport = httpx.AsyncHTTPTransport(trust_env=False)

    async def handle_async_request(self, request):
        # Base URL has already been validated; re-check the destination at connect time.
        host = request.url.host
        port = request.url.port or (443 if request.url.scheme == "https" else 80)
        try:
            records = await asyncio.wait_for(
                asyncio.get_running_loop().getaddrinfo(host, port, type=socket.SOCK_STREAM),
                timeout=10,
            )
        except (OSError, TimeoutError):
            raise httpx.ConnectError("Endpoint lookup failed") from None
        addresses = list(dict.fromkeys(record[4][0] for record in records))
        if not addresses or (not self.allow_local and any(
            not public_address(address) for address in addresses
        )):
            raise httpx.ConnectError("Endpoint address is not permitted")
        pinned = httpx.Request(
            request.method,
            request.url.copy_with(host=addresses[0]),
            headers=request.headers,
            stream=request.stream,
            extensions={**request.extensions, "sni_hostname": host},
        )
        return await self.transport.handle_async_request(pinned)

    async def aclose(self):
        await self.transport.aclose()


class KeyVault:
    _lock = Lock()

    def __init__(self, filename):
        self.path = Path(filename)

    def cipher(self, create=False):
        with self._lock:
            return self._load_cipher(create)

    def _load_cipher(self, create):
        if create and not self.path.exists():
            self.path.parent.mkdir(parents=True, exist_ok=True)
            try:
                fd = os.open(self.path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            except FileExistsError:
                pass
            else:
                with os.fdopen(fd, "wb") as file:
                    file.write(Fernet.generate_key())
                    file.flush()
                    os.fsync(file.fileno())
        return Fernet(self.path.read_bytes().strip())

    def encrypt(self, value):
        return self.cipher(create=True).encrypt(value.encode()).decode()

    def decrypt(self, value):
        return self.cipher().decrypt(value.encode()).decode()
