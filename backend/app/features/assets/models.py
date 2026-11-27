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


class AssetStatus(str, enum.Enum):
    AVAILABLE = "available"
    IN_USE = "in_use"
    BORROWED = "borrowed"
    UNDER_REPAIR = "under_repair"
    RETIRED = "retired"


class AssetCondition(str, enum.Enum):
    WORKING = "working"
    FOR_REPLACEMENT = "for_replacement"
    MAINTENANCE = "maintenance"
    FOR_CONDEMN = "for_condemn"
    FOR_WARRANTY = "for_warranty"
    GOOD = "good"
    FAIR = "fair"
    DEFECTIVE = "defective"


class AssetEditRequestStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class Category(Base, TimestampMixin):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)


class Asset(Base, TimestampMixin):
    __tablename__ = "assets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    asset_tag: Mapped[str] = mapped_column(String(60), unique=True, index=True, nullable=False)
    serial_number: Mapped[str | None] = mapped_column(String(100), unique=True, nullable=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    brand_model: Mapped[str | None] = mapped_column(String(150), nullable=True)
    specs: Mapped[str | None] = mapped_column(Text, nullable=True)
    mac_address: Mapped[str | None] = mapped_column(String(50), nullable=True)
    operating_system: Mapped[str | None] = mapped_column(String(150), nullable=True)
    processor: Mapped[str | None] = mapped_column(String(150), nullable=True)
    ram: Mapped[str | None] = mapped_column(String(50), nullable=True)
    storage: Mapped[str | None] = mapped_column(String(100), nullable=True)
    acquisition_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    acquisition_cost: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    assigned_department: Mapped[str | None] = mapped_column(String(150), nullable=True)
    last_audited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    comments: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(255), nullable=True)

    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"), nullable=False)
    lab_room_id: Mapped[int | None] = mapped_column(ForeignKey("lab_rooms.id"), nullable=True)
    station_id: Mapped[int | None] = mapped_column(ForeignKey("lab_stations.id"), nullable=True)

    status: Mapped[AssetStatus] = mapped_column(Enum(AssetStatus), default=AssetStatus.AVAILABLE, nullable=False)
    condition: Mapped[AssetCondition] = mapped_column(
        Enum(AssetCondition),
        default=AssetCondition.WORKING,
        nullable=False,
    )
    deactivated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class AssetEditRequest(Base, TimestampMixin):
    __tablename__ = "asset_edit_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    asset_id: Mapped[int] = mapped_column(ForeignKey("assets.id"), nullable=False, index=True)
    requested_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    reviewed_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    proposed_changes: Mapped[dict] = mapped_column(JSON, nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[AssetEditRequestStatus] = mapped_column(
        Enum(AssetEditRequestStatus),
        default=AssetEditRequestStatus.PENDING,
        nullable=False,
    )
    review_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)