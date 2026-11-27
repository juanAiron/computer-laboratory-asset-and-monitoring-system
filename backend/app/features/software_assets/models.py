import enum
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    JSON,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.audit import Base, TimestampMixin


class SoftwareStatus(str, enum.Enum):
    ACTIVE = "active"
    TRIAL = "trial"
    RENEWAL_DUE = "renewal_due"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


class SoftwareEditRequestStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class SoftwareAsset(Base, TimestampMixin):
    __tablename__ = "software_assets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    product_name: Mapped[str] = mapped_column(String(150), nullable=False)
    vendor: Mapped[str] = mapped_column(String(150), nullable=False)
    version: Mapped[str | None] = mapped_column(String(100), nullable=True)
    license_type: Mapped[str] = mapped_column(String(50), nullable=False)
    license_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    currency_code: Mapped[str] = mapped_column(String(3), nullable=False, default="PHP", server_default="PHP")
    assigned_to: Mapped[str | None] = mapped_column(String(200), nullable=True)
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    renewal_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    expiry_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    annual_cost: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    status: Mapped[SoftwareStatus] = mapped_column(
        Enum(SoftwareStatus),
        default=SoftwareStatus.ACTIVE,
        nullable=False,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    deactivated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class SoftwareEditRequest(Base, TimestampMixin):
    __tablename__ = "software_edit_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    software_asset_id: Mapped[int] = mapped_column(
        ForeignKey("software_assets.id"),
        nullable=False,
        index=True,
    )
    requested_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    reviewed_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    proposed_changes: Mapped[dict] = mapped_column(JSON, nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[SoftwareEditRequestStatus] = mapped_column(
        Enum(SoftwareEditRequestStatus),
        default=SoftwareEditRequestStatus.PENDING,
        nullable=False,
    )
    review_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
