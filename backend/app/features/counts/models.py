import enum
from datetime import datetime, timezone
from sqlalchemy import DateTime, Enum, ForeignKey, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.audit import Base, TimestampMixin


class CountStatus(str, enum.Enum):
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


class CountItemStatus(str, enum.Enum):
    PENDING = "pending"
    FOUND = "found"
    MISPLACED = "misplaced"
    MISSING = "missing"


class InventoryCount(Base, TimestampMixin):
    __tablename__ = "inventory_counts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    lab_room_id: Mapped[int] = mapped_column(ForeignKey("lab_rooms.id"), nullable=False)
    conducted_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    status: Mapped[CountStatus] = mapped_column(Enum(CountStatus), default=CountStatus.IN_PROGRESS, nullable=False)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class CountItem(Base):
    __tablename__ = "count_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    count_id: Mapped[int] = mapped_column(ForeignKey("inventory_counts.id"), nullable=False)
    asset_id: Mapped[int] = mapped_column(ForeignKey("assets.id"), nullable=False)
    status: Mapped[CountItemStatus] = mapped_column(
        Enum(CountItemStatus), default=CountItemStatus.PENDING, nullable=False
    )
    scanned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)