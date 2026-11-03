import base64
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from io import BytesIO
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from PIL import Image, PngImagePlugin
from sqlalchemy import select, text

from app.community import (
    DEFAULT_SUPPORT_CONTENT,
    MAX_IMAGE_BYTES,
    MAX_SUPPORT_BODY_BYTES,
    initialize_support,
)
from app.db import Database
from app.models import Feedback, SupportSettings, User, utcnow
from tests.test_guest_join import anonymous_join, invitation


def image_bytes(format_="PNG", size=(40, 40), animated=False):
    output = BytesIO()
    image = Image.new("RGB", size, "white")
    options = {}
    if format_ == "PNG":
        info = PngImagePlugin.PngInfo()
        info.add_text("private", "strip-this-metadata")
        options["pnginfo"] = info
    if animated:
        options.update(save_all=True, append_images=[Image.new("RGB", size, "black")],
                       duration=50, loop=0)
    image.save(output, format=format_, **options)
    return output.getvalue()


def encoded_image(**kwargs):
    return base64.b64encode(image_bytes(**kwargs)).decode()


def submit(user, key="request-0001", content="A useful suggestion"):
    return user.post("/api/feedback", json={"content": content, "client_request_id": key})


def test_public_contract_and_feedback_snapshot(system, actor):
    client, app, *_ = system
    assert client.get("/api/feedback", headers={"cookie": ""}).json() == {
        "items": [], "total": 0, "page": 1, "page_size": 20,
    }
    user = actor("alice")
    with app.state.database.session() as db:
        account = db.get(User, user.user["id"])
        account.name = "Alice Example"
        db.commit()
    response = submit(user, content="  A useful suggestion\n<script>alert(1)</script>  ")
    assert response.status_code == 201
    item = response.json()
    assert set(item) == {"id", "author_name", "content", "created_at"}
    assert item["author_name"] == "Alice Example"
    assert item["content"] == "A useful suggestion\n<script>alert(1)</script>"
    assert item["created_at"].endswith("+00:00")
    assert client.get("/api/feedback", headers={"cookie": ""}).json()["items"] == [item]
    with app.state.database.session() as db:
        account = db.get(User, user.user["id"])
        account.name = "Changed"
        db.commit()
    assert client.get("/api/feedback").json()["items"] == [item]


def test_community_authorization_and_origins(system, actor):
    client, *_ = system
    user = actor("alice")
    _, token = invitation(user)
    guest, _ = anonymous_join(system, token)
    assert client.post("/api/feedback", headers={"cookie": ""},
                       json={"content": "hello", "client_request_id": "request-0001"}).status_code == 401
    assert submit(guest).status_code == 403
    for path in ("/api/admin/feedback", "/api/admin/support"):
        for method in ("get", "patch") if path.endswith("support") else ("get",):
            kwargs = {"json": {"content": "hello", "revision": 0}} if method == "patch" else {}
            assert getattr(client, method)(path, headers={"cookie": ""}, **kwargs).status_code == 401
            assert getattr(user, method)(path, **kwargs).status_code == 403
            assert getattr(guest, method)(path, **kwargs).status_code == 403
    response = submit(user)
    target = f"/api/admin/feedback/{response.json()['id']}"
    assert user.patch(target, json={"is_hidden": True}).status_code == 403
    admin = actor("admin")
    for path, payload in [
        ("/api/feedback", {"content": "hello", "client_request_id": "request-0002"}),
        ("/api/admin/support", {"content": "hello", "revision": 0}),
        (target, {"is_hidden": True}),
    ]:
        method = client.post if path == "/api/feedback" else client.patch
        assert method(path, headers={**admin.headers, "origin": "https://evil.example"},
                      json=payload).status_code == 403


def test_idempotency_rate_limit_and_rolling_window(system, actor):
    _, app, *_ = system
    user, other = actor("alice"), actor("other")
    first = submit(user).json()
    for _ in range(8):
        replay = submit(user)
        assert replay.status_code == 200 and replay.json() == first
    assert submit(user, content="different content").status_code == 409
    assert submit(other).status_code == 201  # Keys are scoped per user.
    for i in range(4):
        assert submit(user, f"request-{i + 2:04}").status_code == 201
    limited = submit(user, "request-0006")
    assert limited.status_code == 429 and limited.headers["Retry-After"] == "60"
    assert submit(user).status_code == 200  # Replays do not consume quota, even when full.
    with app.state.database.session() as db:
        row = db.get(Feedback, first["id"])
        row.created_at = utcnow() - timedelta(seconds=61)
        db.commit()
    assert submit(user, "request-0006").status_code == 201


def test_concurrent_new_feedback_limit_and_duplicate_idempotency(system, actor):
    _, app, *_ = system
    user = actor("alice")
    with ThreadPoolExecutor(max_workers=8) as pool:
        responses = list(pool.map(lambda i: submit(user, f"request-{i:04}"), range(10)))
    assert sorted(response.status_code for response in responses) == [201] * 5 + [429] * 5
    other = actor("other")
    with ThreadPoolExecutor(max_workers=8) as pool:
        duplicates = list(pool.map(lambda _: submit(other), range(8)))
    assert sorted(response.status_code for response in duplicates) == [200] * 7 + [201]
    assert len({response.json()["id"] for response in duplicates}) == 1
    with app.state.database.session() as db:
        assert len(list(db.scalars(select(Feedback)))) == 6


@pytest.mark.parametrize("payload", [
    {}, {"content": "hello"}, {"content": "", "client_request_id": "request-1"},
    {"content": " \n ", "client_request_id": "request-1"},
    {"content": "x" * 2001, "client_request_id": "request-1"},
    {"content": "hi", "client_request_id": "short"},
    {"content": "hi", "client_request_id": " " * 8},
    {"content": "hi", "client_request_id": "x" * 101},
    {"content": "hi", "client_request_id": "request-1", "author_name": "spoofed"},
    {"content": "hi", "client_request_id": "request-1", "is_hidden": False},
])
def test_feedback_invalid_payloads(actor, payload):
    assert actor("alice").post("/api/feedback", json=payload).status_code == 422


def test_moderation_filter_pagination_and_stable_order(system, actor):
    client, app, *_ = system
    user, admin = actor("alice"), actor("admin")
    items = [submit(user, f"request-{i:04}", f"suggestion {i}").json() for i in range(5)]
    # Force equal timestamps to exercise the deterministic secondary sort key.
    with app.state.database.session() as db:
        for row in db.scalars(select(Feedback)):
            row.created_at = utcnow().replace(microsecond=0)
        db.commit()
    hidden_id = items[1]["id"]
    result = admin.patch(f"/api/admin/feedback/{hidden_id}", json={"is_hidden": True})
    assert result.status_code == 200 and result.json()["is_hidden"] is True
    assert set(result.json()) == {"id", "author_name", "content", "created_at", "is_hidden"}
    expected = sorted([item["id"] for item in items if item["id"] != hidden_id], reverse=True)
    public = client.get("/api/feedback?page=1&page_size=2").json()
    assert public["total"] == 4 and public["page_size"] == 2
    assert [item["id"] for item in public["items"]] == expected[:2]
    assert [item["id"] for item in client.get("/api/feedback?page=2&page_size=2").json()["items"]] == expected[2:]
    assert client.get("/api/feedback?page=99").json()["items"] == []
    assert admin.get("/api/admin/feedback?status=all").json()["total"] == 5
    assert admin.get("/api/admin/feedback?status=visible").json()["total"] == 4
    assert admin.get("/api/admin/feedback?status=hidden").json()["items"][0]["id"] == hidden_id
    assert admin.patch("/api/admin/feedback/missing", json={"is_hidden": True}).status_code == 404
    for payload in ({}, {"is_hidden": "true"}, {"is_hidden": 1}, {"is_hidden": True, "x": 1}):
        assert admin.patch(f"/api/admin/feedback/{hidden_id}", json=payload).status_code == 422
    assert admin.patch(f"/api/admin/feedback/{hidden_id}", json={"is_hidden": False}).status_code == 200
    assert client.get("/api/feedback").json()["total"] == 5


@pytest.mark.parametrize("query", ["page=0", "page=-1", "page_size=0", "page_size=101", "page=no"])
def test_feedback_pagination_validation(system, actor, query):
    client, *_ = system
    assert client.get(f"/api/feedback?{query}").status_code == 422
    assert actor("admin").get(f"/api/admin/feedback?{query}").status_code == 422


def test_feedback_is_removed_with_account(system, actor):
    client, app, *_ = system
    user, admin = actor("alice"), actor("admin")
    item = submit(user).json()
    assert admin.delete(f"/api/admin/accounts/{user.user['id']}").status_code == 204
    assert client.get("/api/feedback").json()["items"] == []
    with app.state.database.session() as db:
        assert db.get(Feedback, item["id"]) is None


def test_support_default_and_content_only_update(system, actor):
    client, app, *_ = system
    expected = {"content": DEFAULT_SUPPORT_CONTENT, "qr_url": None, "revision": 0}
    assert client.get("/api/support", headers={"cookie": ""}).json() == expected
    assert client.get("/api/support/qr").status_code == 404
    admin = actor("admin")
    assert admin.get("/api/admin/support").json() == expected
    assert "mobile" in DEFAULT_SUPPORT_CONTENT
    assert "Google Play (CH Play)" in DEFAULT_SUPPORT_CONTENT
    assert "App Store" in DEFAULT_SUPPORT_CONTENT
    with app.state.database.session() as db:
        initial_updated_at = db.get(SupportSettings, 1).updated_at
    response = admin.patch("/api/admin/support", json={"content": "  Help us grow  ", "revision": 0})
    with app.state.database.session() as db:
        assert db.get(SupportSettings, 1).updated_at >= initial_updated_at
    assert response.json() == {"content": "Help us grow", "qr_url": None, "revision": 1}
    assert admin.patch("/api/admin/support", json={"content": "stale", "revision": 0}).status_code == 409
    initialize_support(app.state.database)
    assert client.get("/api/support").json() == response.json()


@pytest.mark.parametrize("format_,media", [("PNG", "image/png"), ("JPEG", "image/jpeg"), ("WEBP", "image/webp")])
def test_support_images_are_normalized_public_and_atomic(system, actor, format_, media):
    client, app, *_ = system
    admin = actor("admin")
    response = admin.patch("/api/admin/support", json={
        "content": "Thank you", "revision": 0, "qr_base64": encoded_image(format_=format_),
    })
    assert response.status_code == 200, response.text
    assert response.json() == {"content": "Thank you", "revision": 1,
                               "qr_url": "/api/support/qr?revision=1"}
    qr = client.get(response.json()["qr_url"], headers={"cookie": ""})
    assert qr.status_code == 200 and qr.headers["content-type"] == media
    assert qr.headers["x-content-type-options"] == "nosniff"
    with Image.open(BytesIO(qr.content)) as image:
        assert image.size == (40, 40) and "private" not in image.info
        assert not image.getexif()
    with app.state.database.session() as db:
        saved = db.get(SupportSettings, 1)
        assert saved.qr_image == qr.content and saved.qr_media_type == media
    # Omission retains the normalized image; stale edits cannot alter either field.
    updated = admin.patch("/api/admin/support", json={"content": "New content", "revision": 1})
    assert updated.json()["qr_url"] == "/api/support/qr?revision=2"
    assert client.get("/api/support/qr").content == qr.content
    assert admin.patch("/api/admin/support", json={"content": "stale", "revision": 1,
                                                   "qr_base64": None}).status_code == 409
    assert client.get("/api/support").json() == updated.json()
    assert client.get("/api/support/qr").content == qr.content
    cleared = admin.patch("/api/admin/support", json={"content": "Cleared", "revision": 2,
                                                      "qr_base64": None})
    assert cleared.json() == {"content": "Cleared", "qr_url": None, "revision": 3}
    assert client.get("/api/support/qr").status_code == 404


@pytest.mark.parametrize("kind", ["bad-base64", "data-url", "empty", "text", "gif", "svg",
                                  "animated-png", "animated-webp", "large-dimension", "oversize", "truncated"])
def test_invalid_qr_never_changes_content_or_revision(system, actor, kind):
    client, *_ = system
    admin = actor("admin")
    original = admin.get("/api/admin/support").json()
    raw = {"text": b"not an image", "svg": b'<svg xmlns="http://www.w3.org/2000/svg"></svg>',
           "oversize": b"x" * (MAX_IMAGE_BYTES + 1), "truncated": image_bytes()[:50]}.get(kind)
    if kind == "gif":
        raw = image_bytes(format_="GIF")
    elif kind.startswith("animated-"):
        raw = image_bytes(format_=kind.removeprefix("animated-").upper(), animated=True)
    elif kind == "large-dimension":
        raw = image_bytes(size=(4097, 1))
    encoded = base64.b64encode(raw).decode() if raw is not None else {
        "bad-base64": "???", "data-url": "data:image/png;base64," + encoded_image(), "empty": "",
    }[kind]
    response = admin.patch("/api/admin/support", json={"revision": 0, "content": "must not save",
                                                      "qr_base64": encoded})
    assert response.status_code == 422, response.text
    assert "must not save" not in response.text
    assert client.get("/api/support").json() == original
    assert client.get("/api/support/qr").status_code == 404


@pytest.mark.parametrize("payload", [
    {}, {"content": "a"}, {"revision": 0}, {"revision": -1, "content": "a"},
    {"revision": True, "content": "a"}, {"revision": "0", "content": "a"},
    {"revision": 0, "content": ""}, {"revision": 0, "content": "  \n"},
    {"revision": 0, "content": "x" * 10001}, {"revision": 0, "content": "a", "x": 1},
    {"revision": 0, "content": "a", "qr_base64": 42},
])
def test_support_schema_validation(actor, payload):
    admin = actor("admin")
    before = admin.get("/api/admin/support").json()
    assert admin.patch("/api/admin/support", json=payload).status_code == 422
    assert admin.get("/api/admin/support").json() == before


def test_support_body_limit_with_and_without_content_length(system, actor):
    client, *_ = system
    admin = actor("admin")
    oversized = b" " * (MAX_SUPPORT_BODY_BYTES + 1)
    assert client.patch("/api/admin/support", content=oversized, headers={
        **admin.headers, "content-type": "application/json",
    }).status_code == 413
    # Iterator makes httpx stream with Transfer-Encoding instead of Content-Length.
    assert client.patch("/api/admin/support", content=iter([oversized[:100], oversized[100:]]),
                        headers={**admin.headers, "content-type": "application/json"}).status_code == 413
    assert admin.get("/api/admin/support").json()["revision"] == 0


def test_concurrent_support_compare_and_swap(actor):
    admin = actor("admin")
    def patch(i):
        return admin.patch("/api/admin/support", json={"revision": 0, "content": f"content {i}"})
    with ThreadPoolExecutor(max_workers=6) as pool:
        results = list(pool.map(patch, range(6)))
    assert sorted(response.status_code for response in results) == [200] + [409] * 5
    winner = next(response.json() for response in results if response.status_code == 200)
    assert admin.get("/api/admin/support").json() == winner


def test_feedback_minimum_maximum_trim_and_hidden_replay(system, actor):
    client, *_ = system
    user, admin = actor("alice"), actor("admin")
    assert submit(user, content="x" * 9).status_code == 422
    assert submit(user, content=" " + "x" * 9 + " ").status_code == 422
    minimum = submit(user, content=" " + "x" * 10 + " ")
    assert minimum.status_code == 201 and minimum.json()["content"] == "x" * 10
    assert submit(user, "request-0002", "x" * 2000).status_code == 201
    admin.patch(f"/api/admin/feedback/{minimum.json()['id']}", json={"is_hidden": True})
    replay = submit(user, content="x" * 10)
    assert replay.status_code == 200 and replay.json() == minimum.json()
    assert client.get("/api/feedback").json()["total"] == 1
    assert admin.get("/api/admin/feedback?status=hidden").json()["total"] == 1
    assert admin.get("/api/admin/feedback?status=invalid").status_code == 422


def test_support_exact_limits_exif_and_large_encoded_input(system, actor):
    client, *_ = system
    admin = actor("admin")
    raw = image_bytes(size=(4096, 1))
    # Trailing upload data is not persisted; the 2 MiB boundary itself is inclusive.
    raw += b"x" * (MAX_IMAGE_BYTES - len(raw))
    response = admin.patch("/api/admin/support", json={
        "revision": 0, "content": "x" * 5000, "qr_base64": base64.b64encode(raw).decode(),
    })
    assert response.status_code == 200, response.text
    assert len(client.get(response.json()["qr_url"]).content) < 1000
    assert admin.patch("/api/admin/support", json={"revision": 1, "content": "x" * 5001}).status_code == 422
    image = Image.new("RGB", (10, 20), "white")
    exif = Image.Exif()
    exif[274] = 6  # Orientation must be applied before stripping metadata.
    exif[315] = "private author"
    output = BytesIO()
    image.save(output, format="JPEG", exif=exif)
    response = admin.patch("/api/admin/support", json={
        "revision": 1, "content": "A useful update", "qr_base64": base64.b64encode(output.getvalue()).decode(),
    })
    assert response.status_code == 200
    with Image.open(BytesIO(client.get(response.json()["qr_url"]).content)) as normalized:
        assert normalized.size == (20, 10)
        assert not normalized.getexif()


def test_locked_accounts_cannot_submit_or_update_support(system, actor):
    _, app, *_ = system
    user, admin = actor("alice"), actor("admin")
    assert admin.patch(f"/api/admin/accounts/{user.user['id']}", json={"is_active": False}).status_code == 200
    assert submit(user).status_code == 401
    # Also revalidate administrator active status on every request.
    with app.state.database.session() as db:
        account = db.get(User, admin.user["id"])
        account.is_active = False
        db.commit()
    assert admin.get("/api/admin/support").status_code == 401
    assert admin.patch("/api/admin/support", json={"revision": 0, "content": "A useful update"}).status_code == 401


def test_community_migration_preserves_existing_data_and_support_restart(tmp_path):
    url = f"sqlite:///{tmp_path / 'community.db'}"
    database = Database(url)
    root = Path(__file__).resolve().parent.parent
    config = Config(str(root / "alembic.ini"))
    config.set_main_option("script_location", str(root / "migrations"))
    with database.engine.begin() as conn:
        config.attributes["connection"] = conn
        command.upgrade(config, "0006")
        conn.execute(text("INSERT INTO users (id, username, password_hash, created_at) "
                          "VALUES ('existing', 'existing', 'unchanged', '2026-01-01')"))
        users = conn.execute(text("SELECT * FROM users")).all()
        command.upgrade(config, "head")
        assert conn.execute(text("SELECT * FROM users")).all() == users
        assert conn.execute(text("PRAGMA foreign_key_check")).all() == []
    initialize_support(database)
    with database.session() as db:
        row = db.get(SupportSettings, 1)
        row.content, row.revision, row.qr_image, row.qr_media_type = "Persistent", 7, image_bytes(), "image/png"
        db.commit()
    database.engine.dispose()
    database = Database(url)
    database.migrate()
    initialize_support(database)
    with database.session() as db:
        row = db.get(SupportSettings, 1)
        assert row.content == "Persistent" and row.revision == 7 and row.qr_image == image_bytes()
    with database.engine.begin() as conn:
        config.attributes["connection"] = conn
        command.downgrade(config, "0006")
        assert conn.execute(text("SELECT * FROM users")).all() == users
        assert conn.execute(text("PRAGMA foreign_key_check")).all() == []
    database.engine.dispose()
