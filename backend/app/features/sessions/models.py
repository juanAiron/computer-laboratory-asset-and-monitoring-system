from datetime import datetime, timezone
from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.audit import Base, TimestampMixin


class LabSession(Base, TimestampMixin):
    __tablename__ = "lab_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    lab_room_id: Mapped[int] = mapped_column(ForeignKey("lab_rooms.id"), nullable=False)
    instructor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    course_code: Mapped[str | None] = mapped_column(String(50), nullable=True)  # e.g., "IT 411"
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class StationLog(Base):
    __tablename__ = "station_logs"
    __table_args__ = (
        # Database-level rule: only ONE active student per workstation at a time
        Index(
            "uq_one_active_student_per_station",
            "station_id",
            unique=True,
            postgresql_where=text("time_out IS NULL"),
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    session_id: Mapped[int | None] = mapped_column(ForeignKey("lab_sessions.id"), nullable=True)
    station_id: Mapped[int] = mapped_column(ForeignKey("lab_stations.id"), nullable=False)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    time_in: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    time_out: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)