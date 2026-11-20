from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_google_slu_token,
)
from app.features.users.models import User, UserRole
from app.shared.audit import AuditLog


def _issue_tokens_for_user(user: User) -> tuple[str, str]:
    access_token = create_access_token(user.id, user.role.value, user.token_version)
    refresh_token = create_refresh_token(user.id, user.token_version)
    return access_token, refresh_token


def authenticate_google_user(db: Session, credential: str) -> tuple[User, str, str]:
    try:
        idinfo = verify_google_slu_token(credential)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc))

    email = idinfo["email"].lower()
    user = db.scalar(select(User).where(User.email == email))

    if not user:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your @slu.edu.ph account is not pre-registered. Contact the TRIL Coordinator.",
        )

    if not user.is_active or user.deactivated_at is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated.",
        )

    access_token, refresh_token = _issue_tokens_for_user(user)
    return user, access_token, refresh_token


def authenticate_break_glass_admin(db: Session, email: str, password: str) -> tuple[User, str, str]:
    """Emergency local login strictly matching SEED_ADMIN_EMAIL & SEED_ADMIN_PASSWORD in .env."""
    if (
        email.lower() != settings.SEED_ADMIN_EMAIL.lower()
        or password != settings.SEED_ADMIN_PASSWORD
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid break-glass credentials",
        )

    user = db.scalar(select(User).where(User.email == settings.SEED_ADMIN_EMAIL.lower()))
    if not user:
        user = User(
            email=settings.SEED_ADMIN_EMAIL.lower(),
            full_name="TRIL System Administrator",
            role=UserRole.TRIL_ADMIN,
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    db.add(
        AuditLog(
            actor_id=user.id,
            action="BREAK_GLASS_LOGIN",
            entity_type="user",
            entity_id=user.id,
            details="Local TRIL Admin fallback login used",
        )
    )
    db.commit()

    access_token, refresh_token = _issue_tokens_for_user(user)
    return user, access_token, refresh_token


def refresh_user_session(db: Session, refresh_token: str | None) -> tuple[User, str, str]:
    if not refresh_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing refresh cookie")

    try:
        payload = decode_token(refresh_token)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    if payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")

    user = db.get(User, int(payload.get("sub", 0)))
    if not user or not user.is_active or user.token_version != payload.get("tv"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session revoked")

    new_access, new_refresh = _issue_tokens_for_user(user)
    return user, new_access, new_refresh


def logout_user(db: Session, user: User) -> None:
    """Increments token_version to immediately invalidate all active tokens."""
    user.token_version += 1
    db.commit()