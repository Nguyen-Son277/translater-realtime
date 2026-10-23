from cryptography.fernet import InvalidToken

from app.config import Settings
from app.models import TranslationSetting
from app.translation import LocalTranslator, TranslationError
from app.translation_security import EndpointTransport, KeyVault, normalize_endpoint


class AccountTranslator:
    """Fetch the room owner's credentials for each independent translation."""

    def __init__(self, settings, database, transport_factory=None):
        self.settings = settings
        self.database = database
        self.vault = KeyVault(settings.translation_key_file)
        self.transport_factory = transport_factory or (
            lambda: EndpointTransport(settings.translation_allow_local)
        )

    def configured_for(self, owner_id):
        with self.database.session() as db:
            return db.get(TranslationSetting, owner_id) is not None

    async def translate(self, text, source, target, *, owner_id):
        with self.database.session() as db:
            row = db.get(TranslationSetting, owner_id)
            if row is None:
                raise TranslationError("not_configured")
            try:
                base = normalize_endpoint(row.base_url, self.settings.translation_allow_local)
                key = self.vault.decrypt(row.encrypted_api_key) if row.encrypted_api_key else ""
            except (ValueError, OSError, InvalidToken):
                raise TranslationError("configuration_error") from None
            snapshot = Settings(
                _env_file=None,
                translation_base_url=base,
                translation_model=row.model,
                translation_api_key=key,
                translation_timeout=self.settings.translation_timeout,
            )
        translator = LocalTranslator(snapshot, transport=self.transport_factory())
        try:
            return await translator.translate(text, source, target)
        finally:
            await translator.close()

    async def close(self):
        pass
