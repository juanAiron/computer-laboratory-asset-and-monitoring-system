import re

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.features.labs.models import LabRoom, LabStation
from app.features.labs.schemas import (
    LabRoomCreate,
    LabRoomDetailResponse,
    LabStationCreate,
    StationOccupancyOut,
)
from app.features.sessions.models import StationLog
from app.features.users.models import User
from app.shared.audit import AuditLog

SCHEDULE_ROOM_CODE_PATTERN = re.compile(r"D[0-9]{3}(?:-[A-Z0-9]{1,6})?")


def list_labs(db: Session) -> list[LabRoom]:
    return list(db.scalars(select(LabRoom).where(LabRoom.is_active.is_(True)).order_by(LabRoom.code)).all())


def create_lab(db: Session, payload: LabRoomCreate, actor: User) -> LabRoom:
    code = payload.code.strip().upper()
    name = payload.name.strip()
    if not SCHEDULE_ROOM_CODE_PATTERN.fullmatch(code):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Room code must use the format D### or D###-suffix.",
        )
    if not name:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Room name is required")
    if db.scalar(select(LabRoom).where(LabRoom.code == code)):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Lab room code already exists")

    lab = LabRoom(
        code=code,
        name=name,
        schedule_button_label=(
            payload.schedule_button_label.strip()
            if payload.schedule_button_label and payload.schedule_button_label.strip()
            else code
        ),
        building=payload.building.strip() if payload.building and payload.building.strip() else None,
        capacity=payload.capacity,
    )
    db.add(lab)
    db.flush()

    db.add(
        AuditLog(
            actor_id=actor.id,
            action="LAB_CREATED",
            entity_type="lab_room",
            entity_id=lab.id,
            details=f"Created lab {lab.code}",
        )
    )
    db.commit()
    db.refresh(lab)
    return lab


def create_station(db: Session, lab_id: int, payload: LabStationCreate, actor: User) -> LabStation:
    lab = db.get(LabRoom, lab_id)
    if not lab:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lab room not found")

    station_num = payload.station_number.strip().upper()
    qr_code = (payload.qr_code or f"{lab.code}-{station_num}").strip().upper()

    if db.scalar(select(LabStation).where(LabStation.qr_code == qr_code)):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Station QR code already exists")

    station = LabStation(
        lab_room_id=lab.id,
        station_number=station_num,
        qr_code=qr_code,
        is_operational=payload.is_operational,
    )
    db.add(station)
    db.flush()

    db.add(
        AuditLog(
            actor_id=actor.id,
            action="STATION_CREATED",
            entity_type="lab_station",
            entity_id=station.id,
            details=f"Added {station_num} to {lab.code}",
        )
    )
    db.commit()
    db.refresh(station)
    return station


def get_lab_seat_map(db: Session, lab_id: int) -> LabRoomDetailResponse:
    lab = db.get(LabRoom, lab_id)
    if not lab:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lab room not found")

    stations = list(
        db.scalars(
            select(LabStation)
            .where(LabStation.lab_room_id == lab_id)
            .order_by(LabStation.station_number.asc())
        ).all()
    )

    station_ids = [s.id for s in stations]
    active_logs = {}
    if station_ids:
        rows = db.execute(
            select(StationLog, User)
            .join(User, StationLog.student_id == User.id)
            .where(StationLog.station_id.in_(station_ids), StationLog.time_out.is_(None))
        ).all()
        for log, student in rows:
            active_logs[log.station_id] = (log, student)

    station_outs: list[StationOccupancyOut] = []
    for s in stations:
        if not s.is_operational:
            st_status = "offline"
            occ_name = None
            occ_id = None
            log_id = None
        elif s.id in active_logs:
            log, student = active_logs[s.id]
            st_status = "occupied"
            occ_name = student.full_name
            occ_id = student.id_number
            log_id = log.id
        else:
            st_status = "available"
            occ_name = None
            occ_id = None
            log_id = None

        station_outs.append(
            StationOccupancyOut(
                id=s.id,
                station_number=s.station_number,
                qr_code=s.qr_code,
                is_operational=s.is_operational,
                status=st_status,
                occupant_name=occ_name,
                occupant_id_number=occ_id,
                active_log_id=log_id,
            )
        )

    return LabRoomDetailResponse(
        id=lab.id,
        code=lab.code,
        name=lab.name,
        schedule_button_label=lab.schedule_button_label,
        building=lab.building,
        capacity=lab.capacity,
        is_active=lab.is_active,
        stations=station_outs,
    )