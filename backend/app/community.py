"""Feedback moderation and database-backed public support content."""
import base64
import binascii
import warnings
from datetime import timedelta
from io import BytesIO
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.routing import APIRoute
from PIL import Image, ImageOps, UnidentifiedImageError
from sqlalchemy import func, select, text, update
from sqlalchemy.exc import IntegrityError

from app.auth import current_account, current_admin
from app.models import Feedback, SupportSettings, iso, utcnow
from app.schemas import FeedbackCreate, FeedbackVisibilityPatch, SupportPatch

DEFAULT_SUPPORT_CONTENT = (
    "Ủng hộ admin phát triển ứng dụng mobile và đưa ứng dụng lên Google Play (CH Play) "
    "và App Store. Mọi sự ủng hộ đều giúp duy trì và cải thiện Transqora. Xin cảm ơn bạn!"
)
MAX_IMAGE_BYTES = 2 * 1024 * 1024
MAX_IMAGE_DIMENSION = 4096
MAX_SUPPORT_BODY_BYTES = 3 * 1024 * 1024


class BoundedCommunityRoute(APIRoute):
    """Bound actual streamed bytes before FastAPI parses JSON (even without Content-Length)."""

    def get_route_handler(self):
        original = super().get_route_handler()

        async def bounded(request):
            if request.method in {"POST", "PATCH"}:
                limit = MAX_SUPPORT_BODY_BYTES if request.url.path == "/api/admin/support" else 32768
                length = request.headers.get("content-length")
                if length is not None:
                    try:
                        too_large = int(length) > limit
                    except ValueError:
                        raise HTTPException(400, "Invalid Content-Length.") from None
                    if too_large:
                        raise HTTPException(413, "Nội dung yêu cầu quá lớn.")
                body = bytearray()
                async for chunk in request.stream():
                    if len(body) + len(chunk) > limit:
                        raise HTTPException(413, "Nội dung yêu cầu quá lớn.")
                    body.extend(chunk)
                request._body = bytes(body)
            return await original(request)

        return bounded


def normalize_qr(encoded: str) -> tuple[bytes, str]:
    try:
        raw = base64.b64decode(encoded, validate=True)
    except (ValueError, binascii.Error):
        raise HTTPException(422, "Ảnh QR phải là chuỗi base64 hợp lệ.") from None
    if not raw or len(raw) > MAX_IMAGE_BYTES:
        raise HTTPException(422, "Ảnh QR phải có dung lượng từ 1 byte đến 2 MiB.")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(raw)) as image:
                format_ = image.format
                if format_ not in {"PNG", "JPEG", "WEBP"}:
                    raise ValueError("unsupported format")
                if getattr(image, "is_animated", False) or getattr(image, "n_frames", 1) != 1:
                    raise ValueError("animated image")
                if not (0 < image.width <= MAX_IMAGE_DIMENSION
                        and 0 < image.height <= MAX_IMAGE_DIMENSION):
                    raise ValueError("invalid dimensions")
                image.verify()
            with Image.open(BytesIO(raw)) as image:
                image.load()  # Reject truncated/corrupt pixel data, not just an accepted header.
                image = ImageOps.exif_transpose(image)
                mode = "RGB" if format_ == "JPEG" else "RGBA"
                # A fresh image drops EXIF, comments, ICC profiles and other uploaded metadata.
                clean = Image.new(mode, image.size)
                clean.paste(image.convert(mode))
                output = BytesIO()
                options = {"quality": 90} if format_ == "JPEG" else (
                    {"lossless": True} if format_ == "WEBP" else {}
                )
                clean.save(output, format=format_, **options)
                return output.getvalue(), {"PNG": "image/png", "JPEG": "image/jpeg",
                                           "WEBP": "image/webp"}[format_]
    except (UnidentifiedImageError, OSError, ValueError, SyntaxError,
            Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise HTTPException(422, "Dùng ảnh PNG, JPEG hoặc WebP hợp lệ, không động, tối đa 4096 px mỗi chiều.") from None


def initialize_support(database):
    with database.session() as db:
        if db.get(SupportSettings, 1) is None:
            db.add(SupportSettings(id=1, content=DEFAULT_SUPPORT_CONTENT, revision=0))
            try:
                db.commit()
            except IntegrityError:
                # Multiple server workers can initialize concurrently; the first seed wins.
                db.rollback()
                if db.get(SupportSettings, 1) is None:
                    raise


def support_dict(row):
    return {"content": row.content,
            "qr_url": f"/api/support/qr?revision={row.revision}" if row.qr_image else None,
            "revision": row.revision}


def feedback_dict(row, admin=False):
    result = {"id": row.id, "author_name": row.author_name,
              "content": row.content, "created_at": iso(row.created_at)}
    if admin:
        result["is_hidden"] = row.is_hidden
    return result


def create_community_router(database):
    router = APIRouter(prefix="/api", tags=["community"], route_class=BoundedCommunityRoute)

    def feedback_page(page, page_size, status, admin=False):
        with database.session() as db:
            statement = select(Feedback)
            if status != "all":
                statement = statement.where(Feedback.is_hidden.is_(status == "hidden"))
            total = db.scalar(select(func.count()).select_from(statement.subquery()))
            rows = db.scalars(statement.order_by(Feedback.created_at.desc(), Feedback.id.desc())
                              .offset((page - 1) * page_size).limit(page_size))
            return {"items": [feedback_dict(row, admin) for row in rows], "total": total,
                    "page": page, "page_size": page_size}

    @router.get("/feedback")
    def list_feedback(page: int = Query(default=1, ge=1),
                      page_size: int = Query(default=20, ge=1, le=100)):
        return feedback_page(page, page_size, "visible")

    @router.post("/feedback", status_code=201)
    def post_feedback(body: FeedbackCreate, response: Response, user=Depends(current_account)):
        with database.session() as db:
            # SQLite is the supported database. Acquire its writer lock BEFORE read/check/insert
            # so both idempotency and the five-new-items limit hold across threads/processes.
            db.execute(text("BEGIN IMMEDIATE"))
            existing = db.scalar(select(Feedback).where(
                Feedback.author_id == user.id, Feedback.client_request_id == body.client_request_id,
            ))
            if existing is not None:
                if existing.content != body.content:
                    raise HTTPException(409, "Mã yêu cầu đã được sử dụng cho nội dung khác.")
                response.status_code = 200
                return feedback_dict(existing)
            now = utcnow()
            count = db.scalar(select(func.count()).select_from(Feedback).where(
                Feedback.author_id == user.id, Feedback.created_at > now - timedelta(minutes=1),
            ))
            if count >= 5:
                raise HTTPException(429, "Bạn chỉ có thể gửi 5 góp ý mới mỗi phút.",
                                    headers={"Retry-After": "60"})
            row = Feedback(author_id=user.id, author_name=user.name or user.username,
                           content=body.content, client_request_id=body.client_request_id,
                           created_at=now)
            db.add(row)
            db.commit()
            return feedback_dict(row)

    @router.get("/admin/feedback")
    def admin_feedback(status: Literal["all", "visible", "hidden"] = "all",
                       page: int = Query(default=1, ge=1),
                       page_size: int = Query(default=20, ge=1, le=100),
                       admin=Depends(current_admin)):
        return feedback_page(page, page_size, status, True)

    @router.patch("/admin/feedback/{feedback_id}")
    def moderate_feedback(feedback_id: str, body: FeedbackVisibilityPatch,
                          admin=Depends(current_admin)):
        with database.session() as db:
            row = db.get(Feedback, feedback_id)
            if row is None:
                raise HTTPException(404, "Không tìm thấy góp ý.")
            row.is_hidden = body.is_hidden
            db.commit()
            return feedback_dict(row, True)

    def read_support():
        with database.session() as db:
            return support_dict(db.get(SupportSettings, 1))

    @router.get("/support")
    def public_support():
        return read_support()

    @router.get("/support/qr")
    def support_qr():
        with database.session() as db:
            row = db.get(SupportSettings, 1)
            if row.qr_image is None:
                raise HTTPException(404, "Chưa thiết lập ảnh QR.")
            return Response(content=row.qr_image, media_type=row.qr_media_type,
                            headers={"Content-Disposition": 'inline; filename="support-qr"'})

    @router.get("/admin/support")
    def admin_support(admin=Depends(current_admin)):
        return read_support()

    @router.patch("/admin/support")
    def patch_support(body: SupportPatch, admin=Depends(current_admin)):
        values = {"content": body.content, "revision": SupportSettings.revision + 1,
                  "updated_at": utcnow()}
        if "qr_base64" in body.model_fields_set:
            values["qr_image"], values["qr_media_type"] = (
                normalize_qr(body.qr_base64) if body.qr_base64 is not None else (None, None)
            )
        with database.session() as db:
            result = db.execute(update(SupportSettings).where(
                SupportSettings.id == 1, SupportSettings.revision == body.revision,
            ).values(**values))
            if result.rowcount != 1:
                raise HTTPException(409, "Nội dung đã được cập nhật. Vui lòng tải lại và thử lại.")
            saved = support_dict(db.get(SupportSettings, 1))
            db.commit()
            return saved

    return router
