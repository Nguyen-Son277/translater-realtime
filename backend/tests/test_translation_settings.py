import asyncio
import json
import socket
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.auth import COOKIE_NAME
from app.config import Settings
from app.main import create_app
from app.models import TranslationSetting
from app.translation import TranslationError
from app.translation_security import EndpointTransport, KeyVault, normalize_endpoint
from tests.conftest import Actor, wait_message
from tests.fakes import FakeRecognizer


@pytest.fixture
def accounts(tmp_path):
    settings = Settings(
        _env_file=None,
        database_url=f"sqlite:///{tmp_path / 'accounts.db'}",
        translation_key_file=str(tmp_path / 'translation.key'),
        speech_enabled=False,
        # Legacy credentials must never be used as a fallback.
        translation_base_url="https://legacy.example/v1",
        translation_model="legacy",
        translation_api_key="legacy-secret",
    )
    app = create_app(settings, recognizer=FakeRecognizer())
    requests = []
    response = {"status": 200, "body": {"choices": [{"message": {"content": "你好"}}]}}

    def respond(request):
        requests.append(request)
        return httpx.Response(response["status"], json=response["body"])

    app.state.translator.transport_factory = lambda: httpx.MockTransport(respond)
    with TestClient(app) as client:
        actors = []
        for name in ("owner", "guest", "outsider"):
            user = client.post('/api/auth/register', json={"username": name, "password": "password123"}).json()
            actors.append(Actor(client, user, client.cookies.get(COOKIE_NAME)))
        yield app, actors, requests, response


def save(actor, model="owner-model", key="owner-secret", url="https://llm.example/v1"):
    return actor.client.put('/api/settings/translation', headers=actor.headers, json={
        "base_url": url, "model": model, "api_key": key,
    })


def test_private_settings_encrypted_persistent_and_blank_keeps_key(accounts):
    app, (owner, guest, _), _, _ = accounts
    assert not owner.get('/api/settings/translation').json()['configured']
    result = save(owner)
    assert result.status_code == 200
    assert result.json() == {
        "configured": True, "base_url": "https://llm.example/v1",
        "model": "owner-model", "has_api_key": True,
    }
    assert "owner-secret" not in result.text
    assert not guest.get('/api/settings/translation').json()['configured']
    with app.state.database.session() as db:
        encrypted = db.get(TranslationSetting, owner.user['id']).encrypted_api_key
        assert encrypted != 'owner-secret'
        assert 'owner-secret' not in encrypted
    path = Path(app.state.settings.translation_key_file)
    assert path.stat().st_mode & 0o777 == 0o600
    assert KeyVault(path).decrypt(encrypted) == 'owner-secret'
    assert save(owner, model="new-model", key="").status_code == 200
    assert owner.post('/api/settings/translation/test').status_code == 200
    with app.state.database.session() as db:
        assert db.get(TranslationSetting, owner.user['id']).encrypted_api_key == encrypted
    assert owner.delete('/api/settings/translation').status_code == 204
    assert not owner.get('/api/settings/translation').json()['has_api_key']
    with app.state.database.session() as db:
        assert db.scalar(select(TranslationSetting)) is None


def test_owner_pays_both_directions_and_retry_uses_latest_settings(accounts):
    app, (owner, guest, outsider), requests, _ = accounts
    room = owner.post('/api/rooms', json={"mode": "remote", "language_a": "vi", "language_b": "zh"}).json()
    room_id = room['id']
    token = owner.post(f'/api/rooms/{room_id}/invite').json()['token']
    assert guest.post('/api/rooms/join', json={"token": token}).status_code == 200
    assert outsider.get(f'/api/config?room_id={room_id}').status_code == 404
    assert save(guest, model="guest-model", key="guest-secret").status_code == 200
    owner.post(f'/api/rooms/{room_id}/messages', json={"text": "Xin chào", "client_message_id": "message-0001"})
    failed = wait_message(owner, room_id, 'error')
    assert failed['error_code'] == 'not_configured'
    assert failed['text'] == 'Xin chào'
    assert requests == []
    assert not guest.get(f'/api/config?room_id={room_id}').json()['translation_configured']
    assert save(owner).status_code == 200
    owner.post(f'/api/rooms/{room_id}/messages/{failed["id"]}/retry')
    wait_message(owner, room_id, 'translated')
    guest.post(f'/api/rooms/{room_id}/messages', json={"text": "你好", "client_message_id": "message-0002"})
    wait_message(owner, room_id, 'translated', count=2)
    assert len(requests) == 2
    for request in requests:
        assert request.headers['authorization'] == 'Bearer owner-secret'
        assert json.loads(request.content)['model'] == 'owner-model'
    assert 'Chinese' in json.loads(requests[0].content)['messages'][0]['content']
    assert 'Vietnamese' in json.loads(requests[1].content)['messages'][0]['content']
    assert guest.get(f'/api/config?room_id={room_id}').json()['translation_is_owner'] is False
    owner.delete('/api/settings/translation')
    guest.post(f'/api/rooms/{room_id}/messages', json={"text": "再见", "client_message_id": "message-0003"})
    failed_again = wait_message(owner, room_id, 'error')
    assert failed_again['error_code'] == 'not_configured'
    save(owner, model="replacement", key="replacement-secret")
    guest.post(f'/api/rooms/{room_id}/messages/{failed_again["id"]}/retry')
    wait_message(owner, room_id, 'translated', count=3)
    assert requests[-1].headers['authorization'] == 'Bearer replacement-secret'
    assert json.loads(requests[-1].content)['model'] == 'replacement'


@pytest.mark.parametrize(('status', 'body', 'code'), [
    (401, {}, 'upstream_auth'),
    (404, {}, 'model_not_found'),
    (400, {'error': {'code': 'invalid_model'}}, 'model_not_found'),
    (429, {'error': {'code': 'insufficient_quota'}}, 'quota_exceeded'),
    (402, {}, 'quota_exceeded'),
    (429, {}, 'rate_limited'),
    (302, {}, 'unavailable'),
    (500, {'message': 'owner-secret'}, 'unavailable'),
])
def test_safe_connection_errors(accounts, status, body, code, caplog):
    _, (owner, _, _), requests, response = accounts
    save(owner)
    response.update(status=status, body=body)
    result = owner.post('/api/settings/translation/test')
    assert result.status_code == 422
    assert result.json()['detail']['code'] == code
    assert len(requests) == 1
    assert 'owner-secret' not in result.text + caplog.text


def test_settings_auth_validation_and_key_not_echoed(accounts):
    _, (owner, guest, _), _, _ = accounts
    owner.client.cookies.clear()
    assert owner.client.get('/api/settings/translation').status_code == 401
    assert save(owner, key='a' * 8193).status_code == 422
    result = save(owner, url='https://llm.example/v1?key=private-key')
    assert result.status_code == 422
    assert 'private-key' not in result.text
    assert save(owner, key='private-key\n').status_code == 200  # trim pasted whitespace
    result = save(owner, key='private\nkey')
    assert result.status_code == 422
    assert 'private' not in result.text
    assert guest.get('/api/settings/translation').json()['configured'] is False
    assert guest.delete('/api/settings/translation').status_code == 204
    assert owner.get('/api/settings/translation').json()['configured'] is True


@pytest.mark.parametrize('url', [
    'http://api.example/v1', 'https://localhost/v1', 'https://127.0.0.1/v1',
    'https://10.1.2.3/v1', 'https://[::1]/v1', 'https://169.254.169.254/v1',
    'https://224.0.0.1/v1', 'https://[ff02::1]/v1',
    'https://user:secret@api.example/v1', 'https://api.example/v1?secret=key',
    'https://api.example/v1#secret', 'https://api.example/v1/chat/completions',
    'https://api.example:0/v1', 'https://api.example\\@localhost/v1',
])
def test_endpoint_input_restrictions(url):
    with pytest.raises(ValueError):
        normalize_endpoint(url)


def test_normalization_and_local_opt_in():
    assert normalize_endpoint(' https://api.example/v1/ ') == 'https://api.example/v1'
    assert normalize_endpoint('https://api.example') == 'https://api.example'
    assert normalize_endpoint('http://127.0.0.1:1234/v1', True) == 'http://127.0.0.1:1234/v1'


async def test_dns_rebinding_blocked_and_public_ip_pinned(monkeypatch):
    transport = EndpointTransport()
    addresses = ['127.0.0.1']

    async def resolve(*args, **kwargs):
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, '', (address, 443)) for address in addresses]

    loop = asyncio.get_running_loop()
    monkeypatch.setattr(loop, 'getaddrinfo', resolve)
    request = httpx.Request('POST', 'https://api.example/v1/chat/completions', content=b'{}')
    with pytest.raises(httpx.ConnectError):
        await transport.handle_async_request(request)
    addresses[:] = ['1.1.1.1', '10.0.0.1']
    with pytest.raises(httpx.ConnectError):
        await transport.handle_async_request(request)
    captured = []

    async def send(pinned):
        captured.append(pinned)
        return httpx.Response(200)

    monkeypatch.setattr(transport.transport, 'handle_async_request', send)
    addresses[:] = ['1.1.1.1']
    await transport.handle_async_request(request)
    assert captured[0].url.host == '1.1.1.1'
    assert captured[0].headers['host'] == 'api.example'
    assert captured[0].extensions['sni_hostname'] == 'api.example'
    await transport.aclose()


async def test_timeout_and_missing_encryption_key(accounts):
    app, (owner, _, _), _, _ = accounts
    save(owner)

    def timeout(request):
        raise httpx.ReadTimeout('sensitive upstream details')

    app.state.translator.transport_factory = lambda: httpx.MockTransport(timeout)
    with pytest.raises(TranslationError, match='timeout'):
        await app.state.translator.translate('Xin chào', 'vi', 'zh', owner_id=owner.user['id'])
    Path(app.state.settings.translation_key_file).unlink()
    with pytest.raises(TranslationError, match='configuration_error'):
        await app.state.translator.translate('Xin chào', 'vi', 'zh', owner_id=owner.user['id'])


async def test_inflight_translation_uses_credential_snapshot(accounts):
    app, (owner, _, _), _, _ = accounts
    save(owner)
    entered = asyncio.Event()
    release = asyncio.Event()
    requests = []

    async def respond(request):
        requests.append(request)
        entered.set()
        await release.wait()
        return httpx.Response(200, json={"choices": [{"message": {"content": "你好"}}]})

    app.state.translator.transport_factory = lambda: httpx.MockTransport(respond)
    task = asyncio.create_task(app.state.translator.translate('Xin chào', 'vi', 'zh', owner_id=owner.user['id']))
    await asyncio.wait_for(entered.wait(), 2)
    save(owner, model='replacement', key='new-secret')
    release.set()
    assert await task == '你好'
    await app.state.translator.translate('Xin chào', 'vi', 'zh', owner_id=owner.user['id'])
    assert requests[0].headers['authorization'] == 'Bearer owner-secret'
    assert json.loads(requests[0].content)['model'] == 'owner-model'
    assert requests[1].headers['authorization'] == 'Bearer new-secret'
    assert json.loads(requests[1].content)['model'] == 'replacement'


def test_upgrade_preserves_existing_accounts_and_rooms(tmp_path):
    from alembic import command
    from alembic.config import Config

    from app.db import Database
    from app.models import Room, User

    database = Database(f"sqlite:///{tmp_path / 'old.db'}")
    root = Path(__file__).resolve().parent.parent
    config = Config(str(root / 'alembic.ini'))
    config.set_main_option('script_location', str(root / 'migrations'))
    with database.engine.begin() as connection:
        config.attributes['connection'] = connection
        command.upgrade(config, '0001')
    with database.session() as db:
        user = User(username='existing', password_hash='unchanged')
        db.add(user)
        db.flush()
        room = Room(owner_id=user.id, title='Existing conversation', mode='shared', language_a='vi', language_b='zh')
        db.add(room)
        db.commit()
    database.migrate()
    database.migrate()  # Startup remains idempotent.
    with database.session() as db:
        assert db.get(User, user.id).password_hash == 'unchanged'
        assert db.get(Room, room.id).title == 'Existing conversation'
        assert db.scalar(select(TranslationSetting)) is None
    database.engine.dispose()
