from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.features.consumables.models import Consumable, MovementType, StockMovement
from app.features.consumables.schemas import ConsumableCreate, ConsumableResponse, StockMovementCreate
from app.features.users.models import User


def _to_response(item: Consumable) -> ConsumableResponse:
    return ConsumableResponse(
        id=item.id,
        name=item.name,
        unit=item.unit,
        quantity=item.quantity,
        reorder_level=item.reorder_level,
        lab_room_id=item.lab_room_id,
        is_low_stock=item.quantity <= item.reorder_level,
    )


def list_consumables(db: Session, low_stock_only: bool = False) -> list[ConsumableResponse]:
    stmt = select(Consumable).where(Consumable.deactivated_at.is_(None)).order_by(Consumable.name.asc())
    if low_stock_only:
        stmt = stmt.where(Consumable.quantity <= Consumable.reorder_level)
    return [_to_response(c) for c in db.scalars(stmt).all()]


def create_consumable(db: Session, payload: ConsumableCreate, actor: User) -> ConsumableResponse:
    if payload.quantity < 0:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Initial quantity cannot be negative")

    item = Consumable(
        name=payload.name.strip(),
        unit=payload.unit.strip(),
        quantity=payload.quantity,
        reorder_level=payload.reorder_level,
        lab_room_id=payload.lab_room_id,
    )
    db.add(item)
    db.flush()

    if payload.quantity > 0:
        db.add(
            StockMovement(
                consumable_id=item.id,
                performed_by_id=actor.id,
                movement_type=MovementType.STOCK_IN,
                quantity_change=payload.quantity,
                reason="Initial stock entry",
            )
        )

    db.commit()
    db.refresh(item)
    return _to_response(item)


def record_movement(db: Session, consumable_id: int, payload: StockMovementCreate, actor: User) -> ConsumableResponse:
    item = db.get(Consumable, consumable_id)
    if not item or item.deactivated_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Consumable not found")

    if payload.movement_type == MovementType.STOCK_IN:
        delta = abs(payload.quantity_change)
    elif payload.movement_type == MovementType.STOCK_OUT:
        delta = -abs(payload.quantity_change)
    else:
        delta = payload.quantity_change

    if item.quantity + delta < 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Insufficient stock ({item.quantity} {item.unit} available)",
        )

    item.quantity += delta
    db.add(
        StockMovement(
            consumable_id=item.id,
            performed_by_id=actor.id,
            movement_type=payload.movement_type,
            quantity_change=delta,
            reason=payload.reason,
        )
    )
    db.commit()
    db.refresh(item)
    return _to_response(item)