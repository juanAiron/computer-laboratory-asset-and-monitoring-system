import re
from pydantic import BaseModel, EmailStr, field_validator, model_validator
from app.features.users.models import UserRole


class GoogleLoginRequest(BaseModel):
    credential: str


class LocalLoginRequest(BaseModel):
    identifier: str
    password: str


class LocalSignupRequest(BaseModel):
    id_number: str
    full_name: str
    password: str
    confirm_password: str

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, value: str) -> str:
        value = " ".join(value.strip().split())
        if len(value) < 2 or len(value) > 100:
            raise ValueError("Full name must be between 2 and 100 characters")
        if sum(char.isalpha() for char in value) < 2:
            raise ValueError("Full name must contain at least 2 letters")
        if any(char.isdigit() for char in value):
            raise ValueError("Full name cannot contain numbers")
        return value

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        if len(value) < 10:
            raise ValueError("Password must be at least 10 characters")
        if not re.search(r"[A-Z]", value):
            raise ValueError("Password must contain one uppercase letter")
        if not re.search(r"[a-z]", value):
            raise ValueError("Password must contain one lowercase letter")
        if not re.search(r"\d", value):
            raise ValueError("Password must contain one number")
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>\-_=+\[\]\\\/;'`~]", value):
            raise ValueError("Password must contain one symbol")
        return value

    @field_validator("confirm_password")
    @classmethod
    def validate_confirm_password(cls, value: str) -> str:
        if not value:
            raise ValueError("Confirm password is required")
        return value

    @field_validator("id_number")
    @classmethod
    def validate_id_number(cls, value: str) -> str:
        value = value.strip()
        if not re.fullmatch(r"\d{7}", value):
            raise ValueError("Student ID number must be exactly 7 digits")
        return value

    @model_validator(mode="after")
    def passwords_match(self):
        if self.password != self.confirm_password:
            raise ValueError("Passwords do not match")
        return self


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    password: str
    confirm_password: str

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        if len(value) < 10:
            raise ValueError("Password must be at least 10 characters")
        if not re.search(r"[A-Z]", value):
            raise ValueError("Password must contain one uppercase letter")
        if not re.search(r"[a-z]", value):
            raise ValueError("Password must contain one lowercase letter")
        if not re.search(r"\d", value):
            raise ValueError("Password must contain one number")
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>\-_=+\[\]\\\/;'`~]", value):
            raise ValueError("Password must contain one symbol")
        return value

    @model_validator(mode="after")
    def passwords_match(self):
        if self.password != self.confirm_password:
            raise ValueError("Passwords do not match")
        return self


class UserSummary(BaseModel):
    id: int
    id_number: str | None
    email: str
    full_name: str
    role: UserRole

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserSummary