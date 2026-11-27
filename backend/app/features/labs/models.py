from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.shared.audit import Base, TimestampMixin


class LabRoom(Base, TimestampMixin):
    __tablename__ = "lab_rooms"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    code: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)  # e.g., "CIS-LAB-1"
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    schedule_button_label: Mapped[str | None] = mapped_column(String(100), nullable=True)
    building: Mapped[str | None] = mapped_column(String(100), nullable=True)
    capacity: Mapped[int] = mapped_column(Integer, default=40, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    deactivated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    stations: Mapped[list["LabStation"]] = relationship(back_populates="lab_room")


class LabStation(Base, TimestampMixin):
    __tablename__ = "lab_stations"
    __table_args__ = (UniqueConstraint("lab_room_id", "station_number", name="uq_lab_station_number"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    lab_room_id: Mapped[int] = mapped_column(ForeignKey("lab_rooms.id"), nullable=False)
    station_number: Mapped[str] = mapped_column(String(20), nullable=False)  # e.g., "PC-01"
    qr_code: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    is_operational: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    lab_room: Mapped["LabRoom"] = relationship(back_populates="stations")