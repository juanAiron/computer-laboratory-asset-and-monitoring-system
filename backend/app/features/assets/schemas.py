from datetime import datetime
from pydantic import BaseModel
from app.features.assets.models import AssetCondition, AssetStatus


class CategoryCreate(BaseModel):
    name: str
    description: str | None = None


class CategoryResponse(BaseModel):
    id: int
    name: str
    description: str | None

    model_config = {"from_attributes": True}


class AssetCreate(BaseModel):
    asset_tag: str
    serial_number: str | None = None
    name: str
    brand_model: str | None = None
    specs: str | None = None
    category_id: int
    lab_room_id: int | None = None
    station_id: int | None = None
    status: AssetStatus = AssetStatus.AVAILABLE
    condition: AssetCondition = AssetCondition.GOOD


class AssetUpdate(BaseModel):
    serial_number: str | None = None
    name: str | None = None
    brand_model: str | None = None
    specs: str | None = None
    category_id: int | None = None
    lab_room_id: int | None = None
    station_id: int | None = None
    status: AssetStatus | None = None
    condition: AssetCondition | None = None


class AssetResponse(BaseModel):
    id: int
    asset_tag: str
    serial_number: str | None
    name: str
    brand_model: str | None
    specs: str | None
    image_url: str | None
    category_id: int
    lab_room_id: int | None
    station_id: int | None
    status: AssetStatus
    condition: AssetCondition
    created_at: datetime

    model_config = {"from_attributes": True}