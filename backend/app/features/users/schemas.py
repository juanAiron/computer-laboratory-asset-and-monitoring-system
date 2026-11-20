from datetime import datetime
from pydantic import BaseModel, EmailStr, field_validator
from app.core.config import settings
from app.features.users.models import UserRole


class UserCreate(BaseModel):
    id_number: str | None = None
    email: EmailStr
    full_name: str
    course_year: str | None = None
    role: UserRole = UserRole.STUDENT

    @field_validator("email")
    @classmethod
    def must_be_slu_domain(cls, v: str) -> str:
        email = v.lower().strip()
        if not email.endswith(f"@{settings.ALLOWED_EMAIL_DOMAIN}"):
            raise ValueError(f"Email must end with @{settings.ALLOWED_EMAIL_DOMAIN}")
        return email


class UserUpdate(BaseModel):
    id_number: str | None = None
    full_name: str | None = None
    course_year: str | None = None
    role: UserRole | None = None
    is_active: bool | None = None


class UserResponse(BaseModel):
    id: int
    id_number: str | None
    email: str
    full_name: str
    course_year: str | None
    role: UserRole
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class CSVImportResult(BaseModel):
    created: int
    updated: int
    skipped: int
    errors: list[str]