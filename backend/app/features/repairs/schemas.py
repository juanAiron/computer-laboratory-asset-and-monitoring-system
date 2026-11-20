from datetime import datetime
from pydantic import BaseModel
from app.features.repairs.models import RepairStatus


class RepairCreate(BaseModel):
    asset_id: int | None = None
    station_id: int | None = None
    issue_description: str


class RepairUpdate(BaseModel):
    status: RepairStatus
    resolution_notes: str | None = None


class RepairResponse(BaseModel):
    id: int
    asset_id: int | None
    station_id: int | None
    reported_by_id: int
    issue_description: str
    status: RepairStatus
    resolution_notes: str | None
    created_at: datetime
    resolved_at: datetime | None

    model_config = {"from_attributes": True}