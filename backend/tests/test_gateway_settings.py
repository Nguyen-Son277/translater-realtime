import asyncio
import json
from pathlib import Path

import httpx
import pytest
from alembic import command
from alembic.config import Config
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient
from sqlalchemy import select, text

from app.auth import origin_allowed, passwords, verify_password
from app.bootstrap import bootstrap_admin
from app.config import Settings
from app.db import Database
from app.gateway_settings import GatewaySettingsStore, GatewaySnapshot
from app.main import create_app
from app.models import TranslationSettings, User
from app.schemas import TranslationSettingsPatch
from app.translation import GatewayTranslator
from tests.conftest import TEST_ENCRYPTION_KEY, settings_for_test
from tests.fakes import FakeRecognizer, FakeTranslator

BASE = "/api/admin/settings/translation"


def test_tunnel_origins_require_same_origin_or_explicit_trust():
    origin = "https://untrusted.trycloudflare.com"
    assert not origin_allowed(origin, "app.example", set())
    assert origin_allowed(origin, "untrusted.trycloudflare.com", set())
    assert origin_allowed(origin, "app.example", {origin})


def test_gateway_admin_authorization_and_empty_configuration(system, actor):
    client, _, *_ = system
    client.cookies.clear()
    for method, path, payload in [("get", BASE, None), ("patch", BASE, {"revision": 0}),
                                  ("post", BASE + "/test", None)]:
        kwargs = {"json": payload} if payload else {}
        client.cookies.clear()
        assert getattr(client, method)(path, **kwargs).status_code == 401
        assert getattr(actor("normal" + method), method)(path, **kwargs).status_code == 403
    admin = actor("admin")
    assert admin.get(BASE).json() == {"base_url": "", "model": "", "api_key_configured": False,
                                      "configured": False, "revision": 0}
    assert admin.post(BASE + "/test").json() == {"detail": "not_configured"}


def test_gateway_encryption_redaction_revision_and_key_patch_semantics(system, actor):
    _, app, *_ = system
    admin = actor("admin")
    result = admin.patch(BASE, json={"revision": 0, "base_url": " http://gateway:8000/v1/ ",
                                     "model": " model-one ", "api_key": "private-api-key"})
    assert result.status_code == 200
    assert result.json() == {"base_url": "http://gateway:8000/v1", "model": "model-one",
                              "api_key_configured": True, "configured": True, "revision": 1}
    assert "private-api-key" not in admin.get(BASE).text
    with app.state.database.session() as db:
        row = db.get(TranslationSettings, 1)
        ciphertext = row.api_key_encrypted
        assert ciphertext != "private-api-key"
        assert Fernet(TEST_ENCRYPTION_KEY.encode()).decrypt(ciphertext.encode()) == b"private-api-key"
        assert "private-api-key" not in str(db.execute(text("SELECT * FROM translation_settings")).all())
    assert admin.patch(BASE, json={"revision": 0, "model": "stale"}).status_code == 409
    assert admin.patch(BASE, json={"revision": 1, "model": "new"}).json()["api_key_configured"] is True
    assert admin.patch(BASE, json={"revision": 2, "api_key": None}).json()["api_key_configured"] is True
    assert admin.patch(BASE, json={"revision": 3, "api_key": ""}).json()["api_key_configured"] is False
    assert admin.patch(BASE, json={"revision": 4, "base_url": ""}).json()["configured"] is False


@pytest.mark.parametrize("payload", [
    {"base_url": "file:///secret"}, {"base_url": "http://user:pass@host"},
    {"base_url": "https://host/path?api_key=secret"}, {"base_url": "https://host/#fragment"},
    {"base_url": "http://host:wrong"}, {"base_url": "https://host/ bad"},
    {"base_url": "https://host/?"}, {"base_url": "https://host/#"},
    {"base_url": "http://host/\u0000path"}, {"base_url": "http://host/\\path"},
    {"api_key": "secret\nkey"}, {"model": "x" * 201}, {"revision": -1},
    {"unexpected": "secret-value"}, {"secret-field-name": "value"},
])
def test_gateway_validation_never_echoes_secrets(actor, payload):
    response = actor("admin").patch(BASE, json={"revision": 0, **payload})
    assert response.status_code == 422
    assert "secret" not in response.text
    assert all("input" not in error for error in response.json()["detail"])


def test_gateway_migration_preserves_existing_accounts_without_implicit_admin(tmp_path):
    database = Database(f"sqlite:///{tmp_path / 'migration.db'}")
    root = Path(__file__).resolve().parent.parent
    config = Config(str(root / "alembic.ini"))
    config.set_main_option("script_location", str(root / "migrations"))
    with database.engine.begin() as conn:
        config.attributes["connection"] = conn
        command.upgrade(config, "0004")
        conn.execute(text("INSERT INTO users (id, username, password_hash, created_at) "
                          "VALUES ('existing', 'admin', 'unchanged-hash', '2026-01-01')"))
        before = dict(conn.execute(text("SELECT * FROM users")).mappings().one())
        command.upgrade(config, "head")
        after = dict(conn.execute(text("SELECT * FROM users")).mappings().one())
        assert after == {**before, "is_admin": 0}
        assert conn.execute(text("SELECT * FROM translation_settings")).all() == []
        assert conn.execute(text("PRAGMA foreign_key_check")).all() == []
        command.downgrade(config, "0004")
        assert dict(conn.execute(text("SELECT * FROM users")).mappings().one()) == before
    database.engine.dispose()


def test_legacy_environment_seed_happens_only_once(tmp_path):
    settings = settings_for_test(database_url=f"sqlite:///{tmp_path / 'seed.db'}",
                                 translation_base_url="http://legacy/v1/",
                                 translation_model="legacy-model", translation_api_key="legacy-secret")
    database = Database(settings.database_url)
    database.migrate()
    store = GatewaySettingsStore(database, settings)
    store.initialize()
    assert store.snapshot() == GatewaySnapshot("http://legacy/v1", "legacy-model", "legacy-secret", 0)
    store.patch(TranslationSettingsPatch(revision=0, base_url="", model="", api_key=""))
    settings.translation_base_url = "http://changed"
    settings.translation_api_key = "changed-secret"
    store.initialize()
    assert store.snapshot() == GatewaySnapshot("", "", "", 1)
    database.engine.dispose()


def test_admin_environment_names_are_bootstrap_aliases(monkeypatch):
    monkeypatch.setenv("ADMIN_USERNAME", "selected")
    monkeypatch.setenv("ADMIN_PASSWORD", "initial-password")
    settings = Settings(_env_file=None)
    assert settings.bootstrap_admin_username == "selected"
    assert settings.bootstrap_admin_password == "initial-password"
    assert "initial-password" not in repr(settings)


def test_gateway_persists_and_wrong_key_fails_closed(tmp_path):
    settings = settings_for_test(database_url=f"sqlite:///{tmp_path / 'settings.db'}", speech_enabled=False)
    database = Database(settings.database_url)
    database.migrate()
    store = GatewaySettingsStore(database, settings)
    store.initialize()
    store.patch(TranslationSettingsPatch(revision=0, base_url="http://model", model="test", api_key="secret"))
    database.engine.dispose()
    second_db = Database(settings.database_url)
    restored = GatewaySettingsStore(second_db, settings)
    restored.initialize()
    assert restored.snapshot() == GatewaySnapshot("http://model", "test", "secret", 1)
    settings.settings_encryption_key = Fernet.generate_key().decode()
    with pytest.raises(RuntimeError, match="Cannot decrypt"):
        GatewaySettingsStore(second_db, settings).initialize()
    second_db.engine.dispose()


@pytest.mark.parametrize("key", ["", "not-a-fernet-key"])
def test_lifespan_requires_encryption_key(tmp_path, key):
    settings = settings_for_test(database_url=f"sqlite:///{tmp_path / 'invalid.db'}", speech_enabled=False)
    settings.settings_encryption_key = key
    app = create_app(settings, recognizer=FakeRecognizer(), translator=FakeTranslator())
    with pytest.raises(RuntimeError, match="SETTINGS_ENCRYPTION_KEY"):
        with TestClient(app):
            pass
    app.state.database.engine.dispose()


def test_bootstrap_requires_initial_configuration_and_preserves_password_on_promotion(tmp_path):
    database = Database(f"sqlite:///{tmp_path / 'bootstrap.db'}")
    database.migrate()
    settings = Settings(_env_file=None)
    with pytest.raises(RuntimeError, match="BOOTSTRAP_ADMIN_USERNAME"):
        bootstrap_admin(database, settings)
    hashed = passwords.hash("original-password")
    with database.session() as db:
        db.add(User(username="existing", name="Original Name", email="old@example.com",
                    password_hash=hashed, is_active=False, must_change_password=True))
        db.commit()
    settings.bootstrap_admin_username = " EXISTING "
    settings.bootstrap_admin_password = "replacement-password"
    bootstrap_admin(database, settings)
    with database.session() as db:
        account = db.scalar(select(User))
        assert account.is_admin and not account.is_active and account.must_change_password
        assert account.password_hash == hashed and account.name == "Original Name"
        assert account.email == "old@example.com"
    # Existing durable role wins over later environment changes, even an invalid password.
    settings.bootstrap_admin_username = "different"
    settings.bootstrap_admin_password = ""
    bootstrap_admin(database, settings)
    with database.session() as db:
        assert list(db.scalars(select(User.username))) == ["existing"]
    database.engine.dispose()


def test_bootstrap_initial_creation_validation_and_no_password_reset(tmp_path):
    database = Database(f"sqlite:///{tmp_path / 'create.db'}")
    database.migrate()
    settings = settings_for_test()
    settings.bootstrap_admin_password = "short"
    with pytest.raises(RuntimeError, match="credentials"):
        bootstrap_admin(database, settings)
    settings.bootstrap_admin_password = "initial-password"
    bootstrap_admin(database, settings)
    settings.bootstrap_admin_password = "different-password"
    bootstrap_admin(database, settings)
    with database.session() as db:
        account = db.scalar(select(User))
        assert account.is_admin and verify_password("initial-password", account.password_hash)
        assert not verify_password("different-password", account.password_hash)
    database.engine.dispose()


async def test_inflight_gateway_request_keeps_snapshot_and_next_request_uses_new_config(system):
    _, app, *_ = system
    store = app.state.gateway_settings
    store.patch(TranslationSettingsPatch(revision=0, base_url="http://first", model="first", api_key="first-key"))
    started, release = asyncio.Event(), asyncio.Event()
    requests = []

    async def respond(request):
        requests.append((str(request.url), json.loads(request.content)["model"], request.headers["authorization"]))
        started.set()
        await release.wait()
        return httpx.Response(200, json={"choices": [{"message": {"content": "Translated"}}]})

    translator = GatewayTranslator(app.state.settings, store, transport=httpx.MockTransport(respond))
    pending = asyncio.create_task(translator.translate("Hello", "en", "vi"))
    await started.wait()
    store.patch(TranslationSettingsPatch(revision=1, base_url="http://second", model="second", api_key="second-key"))
    release.set()
    assert await pending == "Translated"
    assert await translator.translate("Hello", "en", "vi") == "Translated"
    assert requests == [("http://first/v1/chat/completions", "first", "Bearer first-key"),
                        ("http://second/v1/chat/completions", "second", "Bearer second-key")]
    await translator.close()


def test_saved_gateway_test_returns_only_safe_code(system, actor, monkeypatch):
    import app.admin
    from app.translation import TranslationError

    class TestTranslator:
        def __init__(self, settings, store):
            assert store.snapshot().model == "saved-model"

        async def translate(self, *args):
            raise TranslationError("upstream_auth")

        async def close(self):
            pass

    admin = actor("admin")
    admin.patch(BASE, json={"revision": 0, "base_url": "http://gateway", "model": "saved-model",
                             "api_key": "do-not-disclose"})
    monkeypatch.setattr(app.admin, "GatewayTranslator", TestTranslator)
    assert admin.post(BASE + "/test").json() == {"detail": "upstream_auth"}
