from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.permissions import get_current_user, require_role
from app.db.session import get_db
from app.features.consumables import service
from app.features.consumables.schemas import ConsumableCreate, ConsumableResponse, StockMovementCreate
from app.features.users.models import User, UserRole

router = APIRouter(prefix="/consumables", tags=["Consumables & Stock"])


@router.get("", response_model=list[ConsumableResponse])
def list_consumables(
    low_stock_only: bool = False,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.list_consumables(db, low_stock_only=low_stock_only)


@router.post("", response_model=ConsumableResponse, status_code=201)
def create_consumable(
    payload: ConsumableCreate,
    current_user: User = Depends(require_role(UserRole.TRIL_ADMIN, UserRole.CUSTODIAN)),
    db: Session = Depends(get_db),
):
    return service.create_consumable(db, payload, current_user)


@router.post("/{consumable_id}/movements", response_model=ConsumableResponse)
def add_stock_movement(
    consumable_id: int,
    payload: StockMovementCreate,
    current_user: User = Depends(require_role(UserRole.TRIL_ADMIN, UserRole.CUSTODIAN)),
    db: Session = Depends(get_db),
):
    return service.record_movement(db, consumable_id, payload, current_user)