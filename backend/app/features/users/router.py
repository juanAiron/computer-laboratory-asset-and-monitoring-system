from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from app.core.permissions import require_role
from app.db.session import get_db
from app.features.users import service
from app.features.users.models import User, UserRole
from app.features.users.schemas import CSVImportResult, UserCreate, UserResponse, UserUpdate

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("", response_model=list[UserResponse])
def list_users(
    search: str | None = None,
    role: UserRole | None = None,
    _: User = Depends(require_role(UserRole.TRIL_ADMIN, UserRole.DEPT_HEAD, UserRole.CUSTODIAN)),
    db: Session = Depends(get_db),
):
    return service.list_users(db, search=search, role=role)


@router.post("", response_model=UserResponse, status_code=201)
def create_user(
    payload: UserCreate,
    current_user: User = Depends(require_role(UserRole.TRIL_ADMIN, UserRole.DEPT_HEAD)),
    db: Session = Depends(get_db),
):
    return service.create_user(db, payload, current_user)


@router.patch("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    payload: UserUpdate,
    current_user: User = Depends(require_role(UserRole.TRIL_ADMIN, UserRole.DEPT_HEAD)),
    db: Session = Depends(get_db),
):
    return service.update_user(db, user_id, payload, current_user)


@router.post("/import-csv", response_model=CSVImportResult)
async def import_csv(
    file: UploadFile = File(...),
    current_user: User = Depends(require_role(UserRole.TRIL_ADMIN)),
    db: Session = Depends(get_db),
):
    content = await file.read()
    return service.import_users_csv(db, content, current_user)