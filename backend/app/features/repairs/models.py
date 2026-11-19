import enum
from datetime import datetime
from sqlalchemy import DateTime, Enum, ForeignKey, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.audit import Base, TimestampMixin


class RepairStatus(str, enum.Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    UNREPAIRABLE = "unrepairable"


class RepairTicket(Base, TimestampMixin):
    __tablename__ = "repair_tickets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    asset_id: Mapped[int | None] = mapped_column(ForeignKey("assets.id"), nullable=True)
    station_id: Mapped[int | None] = mapped_column(ForeignKey("lab_stations.id"), nullable=True)
    reported_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    assigned_to_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    issue_description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[RepairStatus] = mapped_column(Enum(RepairStatus), default=RepairStatus.OPEN, nullable=False)
    resolution_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)