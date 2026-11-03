import re
from typing import Annotated, Literal

from pydantic import (
    BaseModel,
    BeforeValidator,
    ConfigDict,
    EmailStr,
    Field,
    field_validator,
    model_validator,
)

from app.config import LANGUAGES


def normalize_email(value):
    return value.strip().lower() if isinstance(value, str) else value


EmailAddress = Annotated[EmailStr, BeforeValidator(normalize_email), Field(max_length=254)]


class Credentials(BaseModel):
    username: str = Field(min_length=3, max_length=32)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("username")
    @classmethod
    def normalize_username(cls, value):
        value = value.strip().lower()
        if not re.fullmatch(r"[a-z0-9_.-]{3,32}", value):
            raise ValueError("Tên đăng nhập gồm 3–32 chữ cái, số, dấu chấm, gạch dưới hoặc gạch ngang.")
        return value


class Registration(Credentials):
    name: str = Field(min_length=1, max_length=100)
    email: EmailAddress
    password_confirmation: str = Field(min_length=8, max_length=128)

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value):
        value = value.strip()
        if not value:
            raise ValueError("Vui lòng nhập tên của bạn.")
        return value

    @model_validator(mode="after")
    def matching_passwords(self):
        if self.password != self.password_confirmation:
            raise ValueError("Mật khẩu nhập lại chưa khớp.")
        return self


class EmailUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailAddress


class PasswordChange(BaseModel):
    model_config = ConfigDict(extra="forbid")

    current_password: str = Field(min_length=8, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)
    new_password_confirmation: str = Field(min_length=8, max_length=128)

    @model_validator(mode="after")
    def matching_passwords(self):
        if self.new_password != self.new_password_confirmation:
            raise ValueError("Mật khẩu nhập lại chưa khớp.")
        if self.new_password == self.current_password:
            raise ValueError("Mật khẩu mới phải khác mật khẩu hiện tại.")
        return self


class AdminPasswordReset(BaseModel):
    model_config = ConfigDict(extra="forbid")

    new_password: str = Field(min_length=8, max_length=128)
    new_password_confirmation: str = Field(min_length=8, max_length=128)

    @model_validator(mode="after")
    def matching_passwords(self):
        if self.new_password != self.new_password_confirmation:
            raise ValueError("Mật khẩu nhập lại chưa khớp.")
        return self


class AccountStatusUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    is_active: bool


SpeechSilenceMs = Annotated[int, Field(strict=True, ge=200, le=2000, multiple_of=20)]
SpeechMaxSegmentMs = Annotated[int, Field(strict=True, ge=1000, le=10000, multiple_of=20)]
SpeechPreviewMs = Annotated[int, Field(strict=True, ge=400, le=5000, multiple_of=20)]


class SpeechSettingsValues(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    silence_ms: SpeechSilenceMs = 1400
    max_segment_ms: SpeechMaxSegmentMs = 8000
    preview_ms: SpeechPreviewMs = 1000

    @model_validator(mode="after")
    def valid_intervals(self):
        if self.silence_ms >= self.max_segment_ms or self.preview_ms >= self.max_segment_ms:
            raise ValueError("Silence and preview intervals must be shorter than the maximum segment.")
        return self


class SpeechSettingsPatch(BaseModel):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True)

    revision: int = Field(strict=True, ge=0)
    silence_ms: SpeechSilenceMs | None = None
    max_segment_ms: SpeechMaxSegmentMs | None = None
    preview_ms: SpeechPreviewMs | None = None

    @field_validator("silence_ms", "max_segment_ms", "preview_ms")
    @classmethod
    def reject_explicit_null(cls, value):
        if value is None:
            raise ValueError("A supplied interval cannot be null.")
        return value


class TranslationSettingsPatch(BaseModel):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True)

    revision: int = Field(ge=0)
    base_url: str = Field(default="", max_length=2048)
    model: str = Field(default="", max_length=200)
    api_key: str | None = Field(default=None, max_length=8192, repr=False)

    @field_validator("base_url")
    @classmethod
    def validate_base_url(cls, value):
        from urllib.parse import urlsplit
        value = value.strip().rstrip("/")
        if not value:
            return value
        try:
            parsed = urlsplit(value)
            valid = (parsed.scheme in {"http", "https"} and parsed.hostname and parsed.port != 0
                     and parsed.username is None and parsed.password is None and not parsed.query
                     and not parsed.fragment
                     and not any(char.isspace() or ord(char) < 32 or ord(char) == 127
                                 for char in value)
                     and "?" not in value and "#" not in value and chr(92) not in value)
        except ValueError:
            valid = False
        if not valid:
            raise ValueError("Use an HTTP(S) gateway URL without credentials, query or fragment.")
        return value

    @field_validator("model")
    @classmethod
    def normalize_model(cls, value):
        return value.strip()

    @field_validator("api_key")
    @classmethod
    def validate_api_key(cls, value):
        if value is not None and any(char in value for char in "\r\n\x00"):
            raise ValueError("Invalid API key.")
        return value


class RoomCreate(BaseModel):
    title: str = Field(default="", max_length=100)
    mode: Literal["shared", "remote"] = "shared"
    language_a: str = "vi"
    language_b: str = "en"

    @model_validator(mode="after")
    def valid_languages(self):
        if self.language_a not in LANGUAGES or self.language_b not in LANGUAGES:
            raise ValueError("Ngôn ngữ chưa được hỗ trợ.")
        if self.language_a == self.language_b:
            raise ValueError("Vui lòng chọn hai ngôn ngữ khác nhau.")
        return self


class JoinRoom(BaseModel):
    token: str = Field(min_length=20, max_length=100)


class TextMessage(BaseModel):
    client_message_id: str = Field(min_length=8, max_length=100)
    text: str = Field(min_length=1, max_length=4000)
    speaker: Literal["A", "B"] | None = None

    @field_validator("text")
    @classmethod
    def not_blank(cls, value):
        if not value.strip():
            raise ValueError("Nội dung không được để trống.")
        return value.strip()


class FeedbackCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    content: str = Field(min_length=10, max_length=2000)
    client_request_id: str = Field(min_length=8, max_length=100)

    @field_validator("content", "client_request_id", mode="before")
    @classmethod
    def trim_text(cls, value):
        return value.strip() if isinstance(value, str) else value


class FeedbackVisibilityPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    is_hidden: bool = Field(strict=True)


class SupportPatch(BaseModel):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True)

    content: str = Field(min_length=1, max_length=5000)
    revision: int = Field(strict=True, ge=0)
    # Omitted preserves the current image; explicit null removes it.
    qr_base64: str | None = Field(default=None, max_length=2796204, repr=False)

    @field_validator("content")
    @classmethod
    def not_blank(cls, value):
        value = value.strip()
        if not value:
            raise ValueError("Nội dung không được để trống.")
        return value


class AssignSpeaker(BaseModel):
    speaker: Literal["A", "B"]
