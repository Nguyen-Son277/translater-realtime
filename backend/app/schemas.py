import re
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.config import LANGUAGES


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
