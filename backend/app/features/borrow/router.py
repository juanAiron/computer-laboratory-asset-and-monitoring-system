from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.permissions import get_current_user, require_role
from app.db.session import get_db
from app.features.borrow import service
from app.features.borrow.schemas import BorrowCreate, BorrowResponse, BorrowReturn
from app.features.users.models import User, UserRole

router = APIRouter(prefix="/borrow", tags=["Equipment Borrowing"])


@router.get("", response_model=list[BorrowResponse])
def list_borrows(
    active_only: bool = False,
    _: User = Depends(require_role(UserRole.TRIL_ADMIN, UserRole.DEPT_HEAD, UserRole.CUSTODIAN)),
    db: Session = Depends(get_db),
):
    return service.list_borrows(db, active_only=active_only)


@router.get("/my", response_model=list[BorrowResponse])
def my_borrows(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.list_borrows(db, borrower_id=current_user.id)


@router.post("", response_model=BorrowResponse, status_code=201)
def checkout_asset(
    payload: BorrowCreate,
    current_user: User = Depends(require_role(UserRole.TRIL_ADMIN, UserRole.CUSTODIAN)),
    db: Session = Depends(get_db),
):
    return service.checkout_asset(db, payload, current_user)


@router.post("/{borrow_id}/return", response_model=BorrowResponse)
def return_asset(
    borrow_id: int,
    payload: BorrowReturn = BorrowReturn(),
    current_user: User = Depends(require_role(UserRole.TRIL_ADMIN, UserRole.CUSTODIAN)),
    db: Session = Depends(get_db),
):
    return service.return_asset(db, borrow_id, payload.notes, current_user)