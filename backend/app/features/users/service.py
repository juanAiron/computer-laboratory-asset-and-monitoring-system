import csv
import io
import re
from datetime import datetime, timezone
from pathlib import Path
import shutil
import uuid
from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session
from fastapi import UploadFile
from app.core.security import hash_password, verify_password

from app.core.config import settings
from app.features.users.models import User, UserRole
from app.features.users.schemas import CSVImportResult, PasswordChange, ProfileUpdate, UserCreate, UserUpdate
from app.shared.audit import AuditLog


def list_users(db: Session, search: str | None = None, role: UserRole | None = None) -> list[User]:
    stmt = select(User).order_by(User.full_name.asc())
    if role:
        stmt = stmt.where(User.role == role)
    if search:
        pattern = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                User.full_name.ilike(pattern),
                User.email.ilike(pattern),
                User.id_number.ilike(pattern),
                User.course_year.ilike(pattern),
            )
        )
    return list(db.scalars(stmt).all())


def create_user(db: Session, payload: UserCreate, actor: User) -> User:
    if db.scalar(select(User).where(User.email == payload.email)):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    if payload.id_number and db.scalar(select(User).where(User.id_number == payload.id_number)):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="ID number already registered")

    user = User(
        id_number=payload.id_number,
        email=payload.email,
        full_name=payload.full_name.strip(),
        course_year=payload.course_year.strip() if payload.course_year else None,
        role=payload.role,
        password_hash=hash_password(payload.password) if payload.password else None,
        is_active=True,
    )
    db.add(user)
    db.flush()

    db.add(
        AuditLog(
            actor_id=actor.id,
            action="USER_CREATED",
            entity_type="user",
            entity_id=user.id,
            details=f"Registered {user.email} as {user.role.value}",
        )
    )
    db.commit()
    db.refresh(user)
    return user


def update_user(db: Session, user_id: int, payload: UserUpdate, actor: User) -> User:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if payload.id_number is not None:
        user.id_number = payload.id_number
    if payload.full_name is not None:
        user.full_name = payload.full_name.strip()
    if payload.course_year is not None:
        user.course_year = payload.course_year.strip() or None
    if payload.role is not None and payload.role != user.role:
        user.role = payload.role
        user.token_version += 1
    if payload.is_active is not None and payload.is_active != user.is_active:
        user.is_active = payload.is_active
        user.deactivated_at = None if payload.is_active else datetime.now(timezone.utc)
        if not payload.is_active:
            user.token_version += 1

    db.add(
        AuditLog(
            actor_id=actor.id,
            action="USER_UPDATED",
            entity_type="user",
            entity_id=user.id,
            details=f"Updated user {user.email}",
        )
    )
    db.commit()
    db.refresh(user)
    return user


def update_profile(db: Session, user: User, payload: ProfileUpdate) -> User:
    full_name = " ".join(payload.full_name.strip().split())
    if len(full_name) < 2:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Display name is too short")
    user.full_name = full_name
    if user.role != UserRole.STUDENT:
        user.course_year = payload.course_year.strip() if payload.course_year else None
        user.department = payload.department.strip() if payload.department else None
        user.office = payload.office.strip() if payload.office else None
    if payload.profile_visibility in {"private", "members", "public"}:
        user.profile_visibility = payload.profile_visibility
    if payload.activity_visibility in {"private", "members"}:
        user.activity_visibility = payload.activity_visibility
    db.commit()
    db.refresh(user)
    return user


def change_password(db: Session, user: User, payload: PasswordChange) -> None:
    if not user.password_hash or not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
    if payload.new_password != payload.confirm_password:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Passwords do not match")
    password = payload.new_password
    if (
        len(password) < 10
        or not re.search(r"[A-Z]", password)
        or not re.search(r"[a-z]", password)
        or not re.search(r"\d", password)
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Password must be 10+ characters with uppercase, lowercase, and a number",
        )
    user.password_hash = hash_password(payload.new_password)
    user.token_version += 1
    db.commit()


async def upload_profile_photo(db: Session, user: User, file: UploadFile) -> User:
    if file.content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only JPG, PNG, and WebP images are allowed")

    upload_dir = Path("uploads/profiles")
    upload_dir.mkdir(parents=True, exist_ok=True)
    extension = Path(file.filename or "").suffix.lower() or ".jpg"
    filename = f"{user.id}-{uuid.uuid4().hex}{extension}"
    destination = upload_dir / filename

    with destination.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    if user.profile_photo_url:
        old_path = Path(user.profile_photo_url.lstrip("/"))
        if old_path.exists():
            old_path.unlink()

    user.profile_photo_url = f"/uploads/profiles/{filename}"
    db.commit()
    db.refresh(user)
    return user


def import_users_csv(db: Session, file_bytes: bytes, actor: User) -> CSVImportResult:
    """
    Parses SLU registrar CSV format:
    No. | ID Number | Name | Course&Year | EMAIL | Status (optional: Role)
    """
    text = file_bytes.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))

    created = 0
    updated = 0
    skipped = 0
    errors: list[str] = []

    for row_num, raw_row in enumerate(reader, start=2):
        row = {k.strip().lower().replace(" ", ""): (v or "").strip() for k, v in raw_row.items() if k}

        id_number = row.get("idnumber") or None
        full_name = row.get("name") or row.get("fullname") or ""
        course_year = row.get("course&year") or row.get("courseyear") or None
        email = (row.get("email") or "").lower()
        enrollment_status = (row.get("status") or "enrolled").lower()
        raw_role = (row.get("role") or "student").lower()

        if not full_name:
            errors.append(f"Row {row_num}: Missing Name")
            continue

        if not email and id_number:
            email = f"{id_number}@{settings.ALLOWED_EMAIL_DOMAIN}"

        if not email:
            errors.append(f"Row {row_num}: Missing both EMAIL and ID Number")
            continue

        if not email.endswith(f"@{settings.ALLOWED_EMAIL_DOMAIN}"):
            errors.append(f"Row {row_num}: {email} is not an @{settings.ALLOWED_EMAIL_DOMAIN} address")
            continue

        try:
            role = UserRole(raw_role)
        except ValueError:
            errors.append(f"Row {row_num}: Invalid role '{raw_role}'")
            continue

        is_enrolled = enrollment_status == "enrolled"

        existing_user = db.scalar(select(User).where(User.email == email))
        if existing_user:
            existing_user.full_name = full_name
            if id_number:
                existing_user.id_number = id_number
            if course_year:
                existing_user.course_year = course_year
            existing_user.is_active = is_enrolled
            existing_user.deactivated_at = None if is_enrolled else datetime.now(timezone.utc)
            updated += 1
            continue

        if not is_enrolled:
            skipped += 1
            continue

        db.add(
            User(
                id_number=id_number,
                email=email,
                full_name=full_name,
                course_year=course_year,
                role=role,
                is_active=True,
            )
        )
        created += 1

    db.add(
        AuditLog(
            actor_id=actor.id,
            action="USER_CSV_IMPORT",
            entity_type="user",
            details=f"CSV Import: {created} created, {updated} updated, {skipped} skipped",
        )
    )
    db.commit()
    return CSVImportResult(created=created, updated=updated, skipped=skipped, errors=errors)