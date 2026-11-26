from datetime import datetime, time, timezone

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Time, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.features.users.models import User
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


class ClassSchedule(Base, TimestampMixin):
    __tablename__ = "class_schedules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    room_code: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    instructor_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    class_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    course_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    course_name: Mapped[str] = mapped_column(String(100), nullable=False)
    instructor_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    schedule_group_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    instructor: Mapped[User | None] = relationship(
        User,
        foreign_keys=[instructor_id],
        lazy="joined",
    )

    @property
    def visible_instructor(self) -> User | None:
        if (
            self.instructor
            and self.instructor.is_active
            and self.instructor.deactivated_at is None
            and self.instructor.profile_visibility != "private"
        ):
            return self.instructor
        return None


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