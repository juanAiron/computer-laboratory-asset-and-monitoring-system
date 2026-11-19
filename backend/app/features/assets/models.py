import enum
from datetime import datetime
from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.audit import Base, TimestampMixin


class AssetStatus(str, enum.Enum):
    AVAILABLE = "available"
    IN_USE = "in_use"
    BORROWED = "borrowed"
    UNDER_REPAIR = "under_repair"
    RETIRED = "retired"


class AssetCondition(str, enum.Enum):
    GOOD = "good"
    FAIR = "fair"
    DEFECTIVE = "defective"


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

    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"), nullable=False)
    lab_room_id: Mapped[int | None] = mapped_column(ForeignKey("lab_rooms.id"), nullable=True)
    station_id: Mapped[int | None] = mapped_column(ForeignKey("lab_stations.id"), nullable=True)

    status: Mapped[AssetStatus] = mapped_column(Enum(AssetStatus), default=AssetStatus.AVAILABLE, nullable=False)
    condition: Mapped[AssetCondition] = mapped_column(Enum(AssetCondition), default=AssetCondition.GOOD, nullable=False)
    deactivated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)