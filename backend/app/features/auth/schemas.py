from pydantic import BaseModel, EmailStr
from app.features.users.models import UserRole


class GoogleLoginRequest(BaseModel):
    credential: str


class LocalLoginRequest(BaseModel):
    email: EmailStr
    password: str


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