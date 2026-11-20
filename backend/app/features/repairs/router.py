from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.permissions import get_current_user, require_role
from app.db.session import get_db
from app.features.repairs import service
from app.features.repairs.models import RepairStatus
from app.features.repairs.schemas import RepairCreate, RepairResponse, RepairUpdate
from app.features.users.models import User, UserRole

router = APIRouter(prefix="/repairs", tags=["Repair Tickets"])


@router.get("", response_model=list[RepairResponse])
def list_repairs(
    status: RepairStatus | None = None,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.list_repairs(db, status_filter=status)


@router.post("", response_model=RepairResponse, status_code=201)
def report_fault(
    payload: RepairCreate,
    current_user: User = Depends(get_current_user),  # Any role (including Students) can report a fault
    db: Session = Depends(get_db),
):
    return service.create_repair_ticket(db, payload, current_user)


@router.patch("/{ticket_id}", response_model=RepairResponse)
def update_repair(
    ticket_id: int,
    payload: RepairUpdate,
    current_user: User = Depends(require_role(UserRole.TRIL_ADMIN, UserRole.CUSTODIAN)),
    db: Session = Depends(get_db),
):
    return service.update_repair_ticket(db, ticket_id, payload, current_user)