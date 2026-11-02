"""Encrypted singleton gateway configuration with immutable per-request snapshots."""
from dataclasses import dataclass, field

from cryptography.fernet import Fernet, InvalidToken
from fastapi import HTTPException
from sqlalchemy import update

from app.models import TranslationSettings


@dataclass(frozen=True)
class GatewaySnapshot:
    base_url: str = ""
    model: str = ""
    api_key: str = field(default="", repr=False)
    revision: int = 0

    @property
    def configured(self):
        return bool(self.base_url and self.model)

    def public(self):
        return {"base_url": self.base_url, "model": self.model,
                "api_key_configured": bool(self.api_key), "configured": self.configured,
                "revision": self.revision}


class GatewaySettingsStore:
    def __init__(self, database, settings):
        self.database = database
        self.settings = settings
        self.cipher = None

    def initialize(self):
        try:
            self.cipher = Fernet(self.settings.settings_encryption_key.encode("ascii"))
        except (ValueError, UnicodeError):
            raise RuntimeError("SETTINGS_ENCRYPTION_KEY must be a valid Fernet key.") from None
        with self.database.session() as db:
            if not db.get(TranslationSettings, 1):
                from app.schemas import TranslationSettingsPatch
                try:
                    initial = TranslationSettingsPatch(
                        revision=0, base_url=self.settings.translation_base_url,
                        model=self.settings.translation_model, api_key=self.settings.translation_api_key,
                    )
                except ValueError:
                    raise RuntimeError("Invalid initial translation gateway configuration.") from None
                encrypted = (self.cipher.encrypt(initial.api_key.encode()).decode()
                             if initial.api_key else None)
                db.add(TranslationSettings(id=1, base_url=initial.base_url, model=initial.model,
                                           api_key_encrypted=encrypted))
                db.commit()
        # Fail startup instead of silently dropping credentials after a key change.
        self.snapshot()

    def snapshot(self):
        with self.database.session() as db:
            row = db.get(TranslationSettings, 1)
            if row is None or self.cipher is None:
                raise RuntimeError("Gateway settings have not been initialized.")
            try:
                key = (self.cipher.decrypt(row.api_key_encrypted.encode()).decode()
                       if row.api_key_encrypted else "")
            except (InvalidToken, UnicodeError, ValueError):
                raise RuntimeError("Cannot decrypt saved gateway credentials; check SETTINGS_ENCRYPTION_KEY.") from None
            return GatewaySnapshot(row.base_url, row.model, key, row.revision)

    def patch(self, body):
        values = {}
        for name in ("base_url", "model"):
            if name in body.model_fields_set:
                values[name] = getattr(body, name)
        if body.api_key is not None:
            values["api_key_encrypted"] = (self.cipher.encrypt(body.api_key.encode()).decode()
                                           if body.api_key else None)
        with self.database.session() as db:
            changed = db.execute(update(TranslationSettings).where(
                TranslationSettings.id == 1, TranslationSettings.revision == body.revision,
            ).values(**values, revision=TranslationSettings.revision + 1))
            if changed.rowcount != 1:
                raise HTTPException(409, "settings_conflict")
            db.commit()
        return self.snapshot()
