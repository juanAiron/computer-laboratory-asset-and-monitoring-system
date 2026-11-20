from datetime import datetime
from pydantic import BaseModel
from app.features.consumables.models import MovementType


class ConsumableCreate(BaseModel):
    name: str
    unit: str = "pcs"
    quantity: int = 0
    reorder_level: int = 5
    lab_room_id: int | None = None


class ConsumableResponse(BaseModel):
    id: int
    name: str
    unit: str
    quantity: int
    reorder_level: int
    lab_room_id: int | None
    is_low_stock: bool

    model_config = {"from_attributes": True}


class StockMovementCreate(BaseModel):
    movement_type: MovementType
    quantity_change: int
    reason: str | None = None


class StockMovementResponse(BaseModel):
    id: int
    consumable_id: int
    performed_by_id: int
    movement_type: MovementType
    quantity_change: int
    reason: str | None
    created_at: datetime

    model_config = {"from_attributes": True}