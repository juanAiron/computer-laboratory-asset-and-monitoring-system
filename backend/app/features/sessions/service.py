from datetime import datetime, timezone
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.features.labs.models import LabRoom, LabStation
from app.features.sessions.models import LabSession, StationLog
from app.features.sessions.schemas import SessionStartRequest, StationLogResponse
from app.features.users.models import User


def start_class_session(db: Session, payload: SessionStartRequest, instructor: User) -> LabSession:
    lab = db.get(LabRoom, payload.lab_room_id)
    if not lab or not lab.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lab room not found")

    # End any lingering open session in the same room
    open_session = db.scalar(
        select(LabSession).where(
            LabSession.lab_room_id == lab.id,
            LabSession.ended_at.is_(None),
        )
    )
    if open_session:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An active class session is already running in this lab room",
        )

    session = LabSession(
        lab_room_id=lab.id,
        instructor_id=instructor.id,
        course_code=payload.course_code.strip().upper() if payload.course_code else None,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def end_class_session(db: Session, session_id: int) -> LabSession:
    session = db.get(LabSession, session_id)
    if not session or session.ended_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Active session not found")

    now = datetime.now(timezone.utc)
    session.ended_at = now

    # Automatically check out any students still logged into stations for this session
    active_logs = db.scalars(
        select(StationLog).where(StationLog.session_id == session.id, StationLog.time_out.is_(None))
    ).all()
    for log in active_logs:
        log.time_out = now

    db.commit()
    db.refresh(session)
    return session


def check_in_station(db: Session, qr_code: str, student: User) -> StationLogResponse:
    station = db.scalar(select(LabStation).where(LabStation.qr_code == qr_code.strip().upper()))
    if not station:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workstation QR code not found")

    if not station.is_operational:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"{station.station_number} is currently marked offline / under repair",
        )

    # Check if student is already checked in somewhere else
    existing_student_log = db.scalar(
        select(StationLog).where(StationLog.student_id == student.id, StationLog.time_out.is_(None))
    )
    if existing_student_log:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You are already checked into a workstation. Please check out first.",
        )

    # Link to active class session in that lab room if one is running
    active_session = db.scalar(
        select(LabSession).where(
            LabSession.lab_room_id == station.lab_room_id,
            LabSession.ended_at.is_(None),
        )
    )

    log = StationLog(
        session_id=active_session.id if active_session else None,
        station_id=station.id,
        student_id=student.id,
    )
    db.add(log)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"{station.station_number} is already occupied by another student",
        )

    db.refresh(log)
    lab = db.get(LabRoom, station.lab_room_id)
    return StationLogResponse(
        id=log.id,
        session_id=log.session_id,
        station_id=station.id,
        station_number=station.station_number,
        lab_code=lab.code if lab else "",
        student_id=log.student_id,
        time_in=log.time_in,
        time_out=log.time_out,
    )


def check_out_station(db: Session, student: User) -> StationLogResponse:
    log = db.scalar(
        select(StationLog).where(StationLog.student_id == student.id, StationLog.time_out.is_(None))
    )
    if not log:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No active workstation check-in found")

    log.time_out = datetime.now(timezone.utc)
    db.commit()
    db.refresh(log)

    station = db.get(LabStation, log.station_id)
    lab = db.get(LabRoom, station.lab_room_id) if station else None
    return StationLogResponse(
        id=log.id,
        session_id=log.session_id,
        station_id=log.station_id,
        station_number=station.station_number if station else "",
        lab_code=lab.code if lab else "",
        student_id=log.student_id,
        time_in=log.time_in,
        time_out=log.time_out,
    )


def get_my_active_station(db: Session, student: User) -> StationLogResponse | None:
    log = db.scalar(
        select(StationLog).where(StationLog.student_id == student.id, StationLog.time_out.is_(None))
    )
    if not log:
        return None
    station = db.get(LabStation, log.station_id)
    lab = db.get(LabRoom, station.lab_room_id) if station else None
    return StationLogResponse(
        id=log.id,
        session_id=log.session_id,
        station_id=log.station_id,
        station_number=station.station_number if station else "",
        lab_code=lab.code if lab else "",
        student_id=log.student_id,
        time_in=log.time_in,
        time_out=log.time_out,
    )