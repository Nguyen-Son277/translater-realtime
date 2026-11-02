"""Durable global speech settings, snapshotted once per microphone capture."""
from fastapi import HTTPException
from pydantic import Field, ValidationError
from sqlalchemy import update
from sqlalchemy.exc import IntegrityError

from app.models import SpeechSettings
from app.schemas import SpeechSettingsValues


class SpeechSnapshot(SpeechSettingsValues):
    revision: int = Field(strict=True, ge=0, default=0)

    def public(self):
        return self.model_dump()


def snapshot_from_row(row):
    return SpeechSnapshot(silence_ms=row.silence_ms, max_segment_ms=row.max_segment_ms,
                          preview_ms=row.preview_ms, revision=row.revision)


class SpeechSettingsStore:
    def __init__(self, database, settings):
        self.database, self.settings = database, settings

    def initialize(self):
        with self.database.session() as db:
            if db.get(SpeechSettings, 1) is None:
                try:
                    initial = SpeechSettingsValues(
                        silence_ms=self.settings.speech_silence_ms,
                        max_segment_ms=self.settings.speech_max_segment_ms,
                        preview_ms=self.settings.speech_preview_ms,
                    )
                except ValidationError:
                    raise RuntimeError("Invalid initial speech segmentation configuration.") from None
                db.add(SpeechSettings(id=1, **initial.model_dump()))
                try:
                    db.commit()
                except IntegrityError:
                    # Another application worker may have seeded the singleton first.
                    db.rollback()
                    if db.get(SpeechSettings, 1) is None:
                        raise
        self.snapshot()

    def snapshot(self):
        with self.database.session() as db:
            row = db.get(SpeechSettings, 1)
            if row is None:
                raise RuntimeError("Speech settings have not been initialized.")
            return snapshot_from_row(row)

    def patch(self, body):
        with self.database.session() as db:
            row = db.get(SpeechSettings, 1)
            if row is None or row.revision != body.revision:
                raise HTTPException(409, "settings_conflict")
            values = snapshot_from_row(row).model_dump(exclude={"revision"})
            values.update(body.model_dump(exclude_unset=True, exclude={"revision"}))
            try:
                validated = SpeechSettingsValues(**values)
            except ValidationError:
                raise HTTPException(422, "invalid_speech_settings") from None
            changed = db.execute(update(SpeechSettings).where(
                SpeechSettings.id == 1, SpeechSettings.revision == body.revision,
            ).values(**validated.model_dump(), revision=SpeechSettings.revision + 1))
            if changed.rowcount != 1:
                raise HTTPException(409, "settings_conflict")
            db.commit()
            # Return this write's revision, not a later concurrent writer's snapshot.
            return SpeechSnapshot(**validated.model_dump(), revision=body.revision + 1)
