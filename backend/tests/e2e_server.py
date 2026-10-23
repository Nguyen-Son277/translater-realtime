"""Explicitly test-only app; never imported by the production entrypoint."""
import tempfile
from pathlib import Path

from app.config import Settings
from app.main import create_app
from tests.fakes import FakeRecognizer, FakeTranslator

directory = tempfile.TemporaryDirectory(prefix="songngu-e2e-")
app = create_app(
    Settings(_env_file=None, database_url=f"sqlite:///{Path(directory.name) / 'app.db'}",
             translation_key_file=str(Path(directory.name) / 'translation.key'),
             speech_enabled=False),
    recognizer=FakeRecognizer(), translator=FakeTranslator(),
)
