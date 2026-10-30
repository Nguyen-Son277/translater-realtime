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


class AssignSpeaker(BaseModel):
    speaker: Literal["A", "B"]
