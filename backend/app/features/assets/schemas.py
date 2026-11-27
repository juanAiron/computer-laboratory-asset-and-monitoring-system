from datetime import date, datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, Field

from app.features.assets.models import (
    AssetCondition,
    AssetEditRequestStatus,
    AssetStatus,
)


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
    mac_address: str | None = Field(default=None, max_length=50)
    operating_system: str | None = Field(default=None, max_length=150)
    processor: str | None = Field(default=None, max_length=150)
    ram: str | None = Field(default=None, max_length=50)
    storage: str | None = Field(default=None, max_length=100)
    acquisition_date: date | None = None
    acquisition_cost: Decimal | None = Field(default=None, ge=0)
    assigned_department: str | None = Field(default=None, max_length=150)
    comments: str | None = None
    category_id: int
    lab_room_id: int | None = None
    station_id: int | None = None
    status: AssetStatus = AssetStatus.AVAILABLE
    condition: AssetCondition = AssetCondition.WORKING


class AssetUpdate(BaseModel):
    asset_tag: str | None = Field(default=None, min_length=1, max_length=60)
    serial_number: str | None = None
    name: str | None = None
    brand_model: str | None = None
    specs: str | None = None
    mac_address: str | None = Field(default=None, max_length=50)
    operating_system: str | None = Field(default=None, max_length=150)
    processor: str | None = Field(default=None, max_length=150)
    ram: str | None = Field(default=None, max_length=50)
    storage: str | None = Field(default=None, max_length=100)
    acquisition_date: date | None = None
    acquisition_cost: Decimal | None = Field(default=None, ge=0)
    assigned_department: str | None = Field(default=None, max_length=150)
    comments: str | None = None
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
    mac_address: str | None
    operating_system: str | None
    processor: str | None
    ram: str | None
    storage: str | None
    acquisition_date: date | None
    acquisition_cost: Decimal | None
    assigned_department: str | None
    last_audited_at: datetime | None
    comments: str | None
    image_url: str | None
    category_id: int
    lab_room_id: int | None
    station_id: int | None
    status: AssetStatus
    condition: AssetCondition
    created_at: datetime

    model_config = {"from_attributes": True}


class AssetEditRequestCreate(BaseModel):
    changes: AssetUpdate
    reason: str


class AssetEditRequestReview(BaseModel):
    note: str | None = None


class AssetEditRequestResponse(BaseModel):
    id: int
    asset_id: int
    asset_tag: str
    asset_name: str
    requested_by_id: int
    requested_by_name: str
    proposed_changes: dict[str, Any]
    reason: str
    status: AssetEditRequestStatus
    review_note: str | None
    created_at: datetime
    reviewed_at: datetime | None

    model_config = {"from_attributes": True}