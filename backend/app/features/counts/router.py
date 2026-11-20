from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.permissions import require_role
from app.db.session import get_db
from app.features.counts import service
from app.features.counts.schemas import CountScanRequest, CountSessionResponse, CountStartRequest
from app.features.users.models import User, UserRole

router = APIRouter(prefix="/counts", tags=["Physical Inventory Counts"])


@router.post("", response_model=CountSessionResponse, status_code=201)
def start_count(
    payload: CountStartRequest,
    current_user: User = Depends(require_role(UserRole.TRIL_ADMIN, UserRole.CUSTODIAN)),
    db: Session = Depends(get_db),
):
    return service.start_inventory_count(db, payload.lab_room_id, payload.notes, current_user)


@router.post("/{count_id}/scan", response_model=CountSessionResponse)
def scan_item(
    count_id: int,
    payload: CountScanRequest,
    _: User = Depends(require_role(UserRole.TRIL_ADMIN, UserRole.CUSTODIAN)),
    db: Session = Depends(get_db),
):
    return service.scan_count_item(db, count_id, payload.asset_tag)


@router.post("/{count_id}/close", response_model=CountSessionResponse)
def close_count(
    count_id: int,
    _: User = Depends(require_role(UserRole.TRIL_ADMIN, UserRole.CUSTODIAN)),
    db: Session = Depends(get_db),
):
    return service.close_inventory_count(db, count_id)