"""The public rename must not reset data or existing browser sessions."""
from datetime import datetime, timedelta
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.auth import COOKIE_NAME, digest_token, passwords
from app.community import DEFAULT_SUPPORT_CONTENT
from app.db import Database
from app.main import create_app
from app.models import Feedback, Membership, Message, Room, Session, SupportSettings, User
from tests.conftest import settings_for_test
from tests.fakes import FakeRecognizer, FakeTranslator

OLD_DEFAULT = (
    "Ủng hộ admin phát triển ứng dụng mobile và đưa ứng dụng lên Google Play (CH Play) "
    "và App Store. Mọi sự ủng hộ đều giúp duy trì và cải thiện Song Ngữ. Xin cảm ơn bạn!"
)
NEW_DEFAULT = OLD_DEFAULT.replace("Song Ngữ", "Transqora")
OLD_TIME = datetime(2020, 1, 2, 3, 4, 5)
QR = b"preserve exact QR bytes"


def migration_config():
    root = Path(__file__).resolve().parent.parent
    config = Config(str(root / "alembic.ini"))
    config.set_main_option("script_location", str(root / "migrations"))
    return config


def migrate(database, version, downgrade=False):
    config = migration_config()
    with database.engine.begin() as connection:
        config.attributes["connection"] = connection
        (command.downgrade if downgrade else command.upgrade)(config, version)


def snapshot(database):
    tables = ("users", "sessions", "rooms", "memberships", "messages", "feedback")
    with database.engine.connect() as connection:
        return {table: connection.execute(text(f"SELECT * FROM {table} ORDER BY 1")).all()
                for table in tables}


def seed(database, content):
    with database.session() as db:
        user = User(id="existing-user", username="existing", name="Existing User",
                    email="existing@example.com", password_hash=passwords.hash("correct-password"))
        db.add(user)
        db.flush()
        db.add(Session(digest=digest_token("legacy-token"), user_id=user.id,
                       expires_at=datetime.now() + timedelta(days=1)))
        db.add(Room(id="existing-room", owner_id=user.id, title="Keep Song Ngữ history",
                    mode="shared", language_a="vi", language_b="en"))
        db.flush()
        db.add(Membership(id="existing-member", room_id="existing-room", user_id=user.id, side="A"))
        db.add(Message(id="existing-message", room_id="existing-room", author_id=user.id,
                       client_message_id="old-message", source="text", text="Song Ngữ history",
                       translation="Existing translation", status="done"))
        db.add(Feedback(id="existing-feedback", author_id=user.id, author_name=user.name,
                        content="Song Ngữ custom feedback", client_request_id="old-feedback"))
        db.add(SupportSettings(id=1, content=content, revision=7, updated_at=OLD_TIME,
                               qr_image=QR, qr_media_type="image/png"))
        db.commit()


@pytest.mark.parametrize("content,converted", [
    (OLD_DEFAULT, True),
    ("Admin's custom Song Ngữ appeal", False),
    (OLD_DEFAULT + " ", False),
    (NEW_DEFAULT, False),
])
def test_brand_migration_only_changes_exact_old_default(tmp_path, content, converted):
    database = Database(f"sqlite:///{tmp_path / 'migration.db'}")
    migrate(database, "0007")
    seed(database, content)
    before = snapshot(database)
    migrate(database, "0008")
    assert snapshot(database) == before
    with database.session() as db:
        row = db.get(SupportSettings, 1)
        assert row.content == (NEW_DEFAULT if converted else content)
        assert row.revision == (8 if converted else 7)
        assert (row.updated_at > OLD_TIME) if converted else (row.updated_at == OLD_TIME)
        assert row.qr_image == QR and row.qr_media_type == "image/png"
        upgrade_time = row.updated_at
    # Re-running head must not re-bump revisions or timestamps.
    migrate(database, "head")
    with database.session() as db:
        assert db.get(SupportSettings, 1).updated_at == upgrade_time
    migrate(database, "0007", downgrade=True)
    assert snapshot(database) == before
    with database.session() as db:
        row = db.get(SupportSettings, 1)
        is_new_default = converted or content == NEW_DEFAULT
        assert row.content == (OLD_DEFAULT if is_new_default else content)
        assert row.revision == (9 if converted else 8 if is_new_default else 7)
        assert row.qr_image == QR and row.qr_media_type == "image/png"
        assert (row.updated_at > OLD_TIME) if is_new_default else (row.updated_at == OLD_TIME)
    database.engine.dispose()


def test_brand_downgrade_preserves_post_upgrade_admin_edit(tmp_path):
    database = Database(f"sqlite:///{tmp_path / 'custom.db'}")
    migrate(database, "0007")
    seed(database, OLD_DEFAULT)
    migrate(database, "0008")
    with database.session() as db:
        row = db.get(SupportSettings, 1)
        row.content, row.revision, row.updated_at = "Custom Transqora appeal", 9, OLD_TIME
        db.commit()
    migrate(database, "0007", downgrade=True)
    with database.session() as db:
        row = db.get(SupportSettings, 1)
        assert (row.content, row.revision, row.updated_at) == ("Custom Transqora appeal", 9, OLD_TIME)
        assert row.qr_image == QR
    database.engine.dispose()


def test_legacy_cookie_and_history_remain_valid_after_startup_migration(tmp_path):
    url = f"sqlite:///{tmp_path / 'legacy.db'}"
    database = Database(url)
    migrate(database, "0007")
    seed(database, OLD_DEFAULT)
    before = snapshot(database)
    database.engine.dispose()
    app = create_app(settings_for_test(database_url=url, speech_enabled=False),
                     recognizer=FakeRecognizer(), translator=FakeTranslator())
    with TestClient(app) as client:
        assert COOKIE_NAME == "songngu_session"
        headers = {"cookie": "songngu_session=legacy-token"}
        response = client.get("/api/auth/me", headers=headers)
        assert response.status_code == 200
        assert response.json()["id"] == "existing-user"
        history = client.get("/api/rooms/existing-room/messages", headers=headers)
        assert history.status_code == 200
        assert history.json()["messages"][0]["text"] == "Song Ngữ history"
        assert client.get("/api/support").json()["content"] == NEW_DEFAULT
        assert client.get("/api/support/qr").content == QR
        assert client.get("/openapi.json").json()["info"]["title"] == "Transqora API"
        # Bootstrap creates only its configured admin; the old user's rows are byte-for-byte intact.
        after = snapshot(app.state.database)
        assert [row for row in after["users"] if row[0] == "existing-user"] == before["users"]
        for table in ("sessions", "rooms", "memberships", "messages", "feedback"):
            assert after[table] == before[table]


def test_new_install_brand_and_openapi_title(system):
    client, *_ = system
    assert DEFAULT_SUPPORT_CONTENT == NEW_DEFAULT
    assert client.get("/api/support").json()["content"] == NEW_DEFAULT
    assert client.get("/openapi.json").json()["info"]["title"] == "Transqora API"
