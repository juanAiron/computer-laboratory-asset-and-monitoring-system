import re
import smtplib
from email.message import EmailMessage

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    create_password_reset_token,
    decode_token,
    hash_password,
    verify_password,
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


def register_local_user(db: Session, id_number: str, full_name: str, password: str) -> User:
    if not re.fullmatch(r"\d{7}", id_number):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Student ID number must be exactly 7 digits")
    normalized_email = f"{id_number}@{settings.ALLOWED_EMAIL_DOMAIN}"
    if db.scalar(select(User).where(User.id_number == id_number)):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Student ID number already registered")
    if db.scalar(select(User).where(User.email == normalized_email)):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    full_name = " ".join(full_name.strip().split())
    if len(full_name) < 2 or len(full_name) > 100:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Full name must be between 2 and 100 characters")
    if sum(char.isalpha() for char in full_name) < 2 or any(char.isdigit() for char in full_name):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Enter a valid full name")
    if len(password) < 10:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Password must be at least 10 characters")
    if not re.search(r"[A-Z]", password) or not re.search(r"[a-z]", password):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Password must contain uppercase and lowercase letters")
    if not re.search(r"\d", password):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Password must contain one number")
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>\-_=+\[\]\\\/;'`~]", password):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Password must contain one symbol")

    user = User(
        id_number=id_number,
        email=normalized_email,
        full_name=full_name.strip(),
        role=UserRole.STUDENT,
        password_hash=hash_password(password),
        is_active=True,
    )
    db.add(user)
    db.flush()
    db.add(
        AuditLog(
            actor_id=user.id,
            action="LOCAL_USER_SIGNUP",
            entity_type="user",
            entity_id=user.id,
            details=f"Registered local account {normalized_email}",
        )
    )
    db.commit()
    db.refresh(user)
    return user


def authenticate_local_user(db: Session, identifier: str, password: str) -> tuple[User, str, str]:
    normalized = identifier.strip().lower()
    if normalized.isdigit() and len(normalized) == 7:
        user = db.scalar(select(User).where(User.id_number == normalized))
    else:
        user = db.scalar(select(User).where(User.email == normalized))

    if not user:
        if normalized.isdigit():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No account is registered with this ID number.",
            )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This email address is not registered.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account is inactive. Contact the system administrator.",
        )

    if not user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This account does not have a local password. Use Google Sign-In.",
        )

    if not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password.",
        )

    access_token, refresh_token = _issue_tokens_for_user(user)
    return user, access_token, refresh_token


def request_password_reset(db: Session, email: str) -> None:
    normalized_email = email.lower().strip()
    user = db.scalar(select(User).where(User.email == normalized_email))
    if not user or not user.is_active or not user.password_hash:
        return

    token = create_password_reset_token(user.id, user.token_version)
    reset_link = f"{settings.FRONTEND_ORIGIN.rstrip('/')}/login?reset_token={token}"

    if not settings.SMTP_HOST or not settings.SMTP_FROM_EMAIL:
        return

    message = EmailMessage()
    message["Subject"] = "CIS TRIL Portal password reset"
    message["From"] = settings.SMTP_FROM_EMAIL
    message["To"] = normalized_email
    message.set_content(
        "We received a request to reset your CIS TRIL Portal password.\n\n"
        f"Reset it within 30 minutes: {reset_link}\n\n"
        "If you did not request this, you can ignore this email."
    )

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as smtp:
        if settings.SMTP_USE_TLS:
            smtp.starttls()
        if settings.SMTP_USERNAME:
            smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD or "")
        smtp.send_message(message)


def reset_password(db: Session, token: str, password: str) -> User:
    try:
        payload = decode_token(token)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Reset link is invalid or has expired") from exc
    if payload.get("type") != "password_reset":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Reset link is invalid")

    user = db.get(User, int(payload.get("sub", 0)))
    if not user or not user.is_active or user.token_version != payload.get("tv"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Reset link is invalid or has expired")
    if len(password) < 10:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Password must be at least 10 characters")
    if not re.search(r"[A-Z]", password) or not re.search(r"[a-z]", password):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Password must contain uppercase and lowercase letters")
    if not re.search(r"\d", password):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Password must contain one number")
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>\-_=+\[\]\\\/;'`~]", password):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Password must contain one symbol")

    user.password_hash = hash_password(password)
    user.token_version += 1
    db.commit()
    db.refresh(user)
    return user


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