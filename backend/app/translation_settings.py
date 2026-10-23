import asyncio

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, SecretStr, field_validator

from app.auth import current_user
from app.models import TranslationSetting
from app.translation import TranslationError
from app.translation_security import KeyVault, normalize_endpoint


class TranslationInput(BaseModel):
    base_url: str = Field(min_length=1, max_length=2048)
    model: str = Field(min_length=1, max_length=200)
    api_key: SecretStr = Field(default=SecretStr(""), max_length=8192)

    @field_validator("model")
    @classmethod
    def valid_model(cls, value):
        value = value.strip()
        if not value or any(ord(char) < 32 or ord(char) == 127 for char in value):
            raise ValueError("Vui lòng nhập tên model hợp lệ.")
        return value


def settings_router(database, settings, translator):
    router = APIRouter(prefix="/api/settings/translation")
    vault = KeyVault(settings.translation_key_file)
    testing = set()
    test_slots = asyncio.Semaphore(settings.translation_concurrency)

    def public(row):
        return {
            "configured": row is not None,
            "base_url": row.base_url if row else "",
            "model": row.model if row else "",
            "has_api_key": bool(row and row.encrypted_api_key),
        }

    @router.get("")
    def get_settings(user=Depends(current_user)):
        with database.session() as db:
            return public(db.get(TranslationSetting, user.id))

    @router.put("")
    def save_settings(body: TranslationInput, user=Depends(current_user)):
        try:
            base = normalize_endpoint(body.base_url, settings.translation_allow_local)
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from None
        key = body.api_key.get_secret_value().strip()
        if any(not char.isascii() or ord(char) < 32 or ord(char) == 127 for char in key):
            raise HTTPException(422, "API key không hợp lệ.")
        with database.session() as db:
            row = db.get(TranslationSetting, user.id)
            if row is None:
                row = TranslationSetting(user_id=user.id, base_url=base, model=body.model)
                db.add(row)
            row.base_url = base
            row.model = body.model
            if key:
                try:
                    row.encrypted_api_key = vault.encrypt(key)
                except (ValueError, OSError):
                    raise HTTPException(503, "Không thể lưu khóa an toàn. Liên hệ quản trị viên.") from None
            db.commit()
            return public(row)

    @router.delete("", status_code=204)
    def delete_settings(user=Depends(current_user)):
        with database.session() as db:
            row = db.get(TranslationSetting, user.id)
            if row:
                db.delete(row)
                db.commit()

    @router.post("/test")
    async def test_settings(user=Depends(current_user)):
        if user.id in testing:
            raise HTTPException(429, "Đang kiểm tra kết nối. Vui lòng đợi.")
        testing.add(user.id)
        try:
            async with test_slots:
                result = await translator.translate("Xin chào", "vi", "zh", owner_id=user.id)
            return {"ok": True, "translation": result}
        except TranslationError as exc:
            # Only a known machine code is exposed, never upstream bodies or credentials.
            raise HTTPException(422, {"code": exc.code}) from None
        finally:
            testing.discard(user.id)

    return router
