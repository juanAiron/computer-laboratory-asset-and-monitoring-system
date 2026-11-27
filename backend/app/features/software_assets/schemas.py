from datetime import date, datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, Field

from app.features.software_assets.models import (
    SoftwareEditRequestStatus,
    SoftwareStatus,
)


class SoftwareAssetCreate(BaseModel):
    product_name: str = Field(min_length=1, max_length=150)
    vendor: str = Field(min_length=1, max_length=150)
    version: str | None = Field(default=None, max_length=100)
    license_type: str = Field(min_length=1, max_length=50)
    license_count: int = Field(default=1, ge=1)
    currency_code: str = Field(default="PHP", min_length=3, max_length=3, pattern=r"^[A-Z]{3}$")
    assigned_to: str | None = Field(default=None, max_length=200)
    start_date: date | None = None
    renewal_date: date | None = None
    expiry_date: date | None = None
    annual_cost: Decimal | None = Field(default=None, ge=0)
    status: SoftwareStatus = SoftwareStatus.ACTIVE
    notes: str | None = None


class SoftwareAssetUpdate(BaseModel):
    product_name: str | None = Field(default=None, min_length=1, max_length=150)
    vendor: str | None = Field(default=None, min_length=1, max_length=150)
    version: str | None = Field(default=None, max_length=100)
    license_type: str | None = Field(default=None, min_length=1, max_length=50)
    license_count: int | None = Field(default=None, ge=1)
    currency_code: str | None = Field(default=None, min_length=3, max_length=3, pattern=r"^[A-Z]{3}$")
    assigned_to: str | None = Field(default=None, max_length=200)
    start_date: date | None = None
    renewal_date: date | None = None
    expiry_date: date | None = None
    annual_cost: Decimal | None = Field(default=None, ge=0)
    status: SoftwareStatus | None = None
    notes: str | None = None


class SoftwareAssetResponse(BaseModel):
    id: int
    product_name: str
    vendor: str
    version: str | None
    license_type: str
    license_count: int
    currency_code: str
    assigned_to: str | None
    start_date: date | None
    renewal_date: date | None
    expiry_date: date | None
    annual_cost: Decimal | None
    status: SoftwareStatus
    notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class SoftwareEditRequestCreate(BaseModel):
    changes: SoftwareAssetUpdate
    reason: str = Field(min_length=1)


class SoftwareEditRequestReview(BaseModel):
    note: str | None = None


class SoftwareEditRequestResponse(BaseModel):
    id: int
    software_asset_id: int
    product_name: str
    requested_by_id: int
    requested_by_name: str
    proposed_changes: dict[str, Any]
    reason: str
    status: SoftwareEditRequestStatus
    review_note: str | None
    created_at: datetime
    reviewed_at: datetime | None
