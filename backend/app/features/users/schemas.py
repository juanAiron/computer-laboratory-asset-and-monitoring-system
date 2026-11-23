from datetime import datetime
from pydantic import BaseModel, EmailStr, model_validator
from app.core.config import settings
from app.features.users.models import UserRole

GOOGLE_ONLY_ROLES = {UserRole.STUDENT, UserRole.INSTRUCTOR}


class UserCreate(BaseModel):
    id_number: str | None = None
    email: EmailStr
    full_name: str
    course_year: str | None = None
    role: UserRole = UserRole.STUDENT
    password: str | None = None

    @model_validator(mode="after")
    def validate_role_auth_rules(self):
        self.email = self.email.lower().strip()
        if self.role in GOOGLE_ONLY_ROLES:
            if not self.email.endswith(f"@{settings.ALLOWED_EMAIL_DOMAIN}"):
                raise ValueError(f"{self.role.value} accounts must end with @{settings.ALLOWED_EMAIL_DOMAIN}")
        else:
            # Custodians, Dept Heads, and TRIL Admins without SLU Google accounts need a local password
            if not self.email.endswith(f"@{settings.ALLOWED_EMAIL_DOMAIN}") and not self.password:
                raise ValueError("A password is required for non-SLU Google staff accounts")
        return self


class UserUpdate(BaseModel):
    id_number: str | None = None
    full_name: str | None = None
    course_year: str | None = None
    role: UserRole | None = None
    password: str | None = None
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