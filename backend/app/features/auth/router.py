import smtplib

from fastapi import APIRouter, Cookie, Depends, Response
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.core.config import settings
from app.core.permissions import get_current_user
from app.core.security import hash_password
from app.db.session import get_db
from app.features.auth import service
from app.features.auth.schemas import (
    GoogleLoginRequest,
    LocalLoginRequest,
    LocalSignupRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    TokenResponse,
    UserSummary,
)
from app.features.users.models import User, UserRole

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _set_refresh_cookie(response: Response, refresh_token: str) -> None:
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        samesite="lax",
        secure=not settings.FRONTEND_ORIGIN.startswith("http://localhost"),
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        path="/api/v1/auth",
    )


@router.post("/google", response_model=TokenResponse)
def google_login(
    payload: GoogleLoginRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    user, access_token, refresh_token = service.authenticate_google_user(db, payload.credential)
    _set_refresh_cookie(response, refresh_token)
    return TokenResponse(access_token=access_token, user=UserSummary.model_validate(user))


@router.post("/local", response_model=TokenResponse)
def local_break_glass_login(
    payload: LocalLoginRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    if (
        payload.identifier.lower() == settings.SEED_ADMIN_EMAIL.lower()
        and payload.password == settings.SEED_ADMIN_PASSWORD
    ):
        user, access_token, refresh_token = service.authenticate_break_glass_admin(
            db, payload.identifier, payload.password
        )
    elif payload.identifier.lower() == settings.SUPER_ADMIN_EMAIL.lower() and payload.password == settings.SUPER_ADMIN_PASSWORD:
        user = db.scalar(select(User).where(User.email == settings.SUPER_ADMIN_EMAIL.lower()))
        if not user:
            user = User(
                email=settings.SUPER_ADMIN_EMAIL.lower(),
                full_name="System Super Administrator",
                role=UserRole.SUPER_ADMIN,
                password_hash=hash_password(settings.SUPER_ADMIN_PASSWORD),
                is_active=True,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        access_token, refresh_token = service._issue_tokens_for_user(user)
    else:
        user, access_token, refresh_token = service.authenticate_local_user(
            db, payload.identifier, payload.password
        )
    _set_refresh_cookie(response, refresh_token)
    return TokenResponse(access_token=access_token, user=UserSummary.model_validate(user))


@router.post("/signup", response_model=TokenResponse)
def local_signup(
    payload: LocalSignupRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    user = service.register_local_user(db, payload.id_number, payload.full_name, payload.password)
    access_token, refresh_token = service._issue_tokens_for_user(user)
    _set_refresh_cookie(response, refresh_token)
    return TokenResponse(access_token=access_token, user=UserSummary.model_validate(user))


@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    try:
        service.request_password_reset(db, payload.email)
    except smtplib.SMTPException:
        pass
    return {"detail": "If an eligible local account exists, password reset instructions will be sent."}


@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    service.reset_password(db, payload.token, payload.password)
    return {"detail": "Password reset successfully. You can now log in."}


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(
    response: Response,
    refresh_token: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
):
    if refresh_token is None:
        return Response(status_code=204)

    user, new_access, new_refresh = service.refresh_user_session(db, refresh_token)
    _set_refresh_cookie(response, new_refresh)
    return TokenResponse(access_token=new_access, user=UserSummary.model_validate(user))


@router.post("/logout")
def logout(
    response: Response,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service.logout_user(db, current_user)
    response.delete_cookie(key="refresh_token", path="/api/v1/auth")
    return {"detail": "Logged out across all sessions"}


@router.get("/me", response_model=UserSummary)
def get_me(current_user: User = Depends(get_current_user)):
    return UserSummary.model_validate(current_user)