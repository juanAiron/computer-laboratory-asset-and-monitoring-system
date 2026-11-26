from fastapi import APIRouter, Depends, File, UploadFile, HTTPException
from sqlalchemy.orm import Session

from app.core.permissions import require_role
from app.core.permissions import get_current_user
from app.db.session import get_db
from app.features.users import service
from app.features.users.models import User, UserRole
from app.features.users.schemas import (
    CSVImportResult,
    InstructorOptionResponse,
    PasswordChange,
    ProfileUpdate,
    UserCreate,
    UserResponse,
    UserUpdate,
)

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=UserResponse)
def get_profile(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserResponse)
def update_profile(
    payload: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.update_profile(db, current_user, payload)


@router.post("/me/password")
def change_password(
    payload: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service.change_password(db, current_user, payload)
    return {"detail": "Password changed successfully"}


@router.post("/me/photo", response_model=UserResponse)
async def upload_profile_photo(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return await service.upload_profile_photo(db, current_user, file)


@router.get("", response_model=list[UserResponse])
def list_users(
    search: str | None = None,
    role: UserRole | None = None,
    _: User = Depends(require_role(UserRole.TRIL_ADMIN, UserRole.DEPT_HEAD, UserRole.CUSTODIAN)),
    db: Session = Depends(get_db),
):
    return service.list_users(db, search=search, role=role)


@router.get("/instructors", response_model=list[InstructorOptionResponse])
def list_active_instructors(
    _: User = Depends(require_role(UserRole.DEPT_HEAD)),
    db: Session = Depends(get_db),
):
    return service.list_active_instructors(db)


@router.get("/instructors/{instructor_id}", response_model=InstructorOptionResponse)
def get_instructor_profile(
    instructor_id: int,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.get_instructor_profile(db, instructor_id)


@router.post("", response_model=UserResponse, status_code=201)
def create_user(
    payload: UserCreate,
    current_user: User = Depends(require_role(UserRole.TRIL_ADMIN, UserRole.DEPT_HEAD)),
    db: Session = Depends(get_db),
):
    if payload.role == UserRole.SUPER_ADMIN and current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Only Super Administrators can create Super Administrators")
    return service.create_user(db, payload, current_user)


@router.patch("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    payload: UserUpdate,
    current_user: User = Depends(require_role(UserRole.TRIL_ADMIN, UserRole.DEPT_HEAD)),
    db: Session = Depends(get_db),
):
    if payload.role == UserRole.SUPER_ADMIN and current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Only Super Administrators can assign Super Administrator")
    return service.update_user(db, user_id, payload, current_user)


@router.post("/import-csv", response_model=CSVImportResult)
async def import_csv(
    file: UploadFile = File(...),
    current_user: User = Depends(require_role(UserRole.TRIL_ADMIN)),
    db: Session = Depends(get_db),
):
    content = await file.read()
    return service.import_users_csv(db, content, current_user)