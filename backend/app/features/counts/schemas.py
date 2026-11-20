from datetime import datetime
from pydantic import BaseModel
from app.features.counts.models import CountItemStatus, CountStatus


class CountStartRequest(BaseModel):
    lab_room_id: int
    notes: str | None = None


class CountScanRequest(BaseModel):
    asset_tag: str


class CountItemOut(BaseModel):
    id: int
    asset_id: int
    asset_tag: str
    asset_name: str
    status: CountItemStatus
    scanned_at: datetime | None


class CountSessionResponse(BaseModel):
    id: int
    lab_room_id: int
    status: CountStatus
    started_at: datetime
    closed_at: datetime | None
    items: list[CountItemOut]