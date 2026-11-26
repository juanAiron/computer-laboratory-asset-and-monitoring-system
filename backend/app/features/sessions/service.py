import re
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.features.labs.models import LabRoom, LabStation
from app.features.sessions.models import ClassSchedule, LabSession, StationLog
from app.features.sessions.schemas import (
    ClassScheduleBulkCreate,
    ClassScheduleCreate,
    ClassScheduleFields,
    SessionStartRequest,
    StationLogResponse,
)
from app.features.users.models import User, UserRole
from app.shared.audit import AuditLog

CLASSROOM_CODES = {
    "D522",
    "D524",
    "D526",
    "D528",
    "D422",
    "D223",
    "D722",
    "D723",
    "D724",
    "D725",
}
CLASS_CODE_PATTERN = re.compile(r"(?:[0-9]{4}[AB]|[0-9]{5})")
COURSE_NUMBER_PATTERN = re.compile(
    r"(?:(?:IT|CS) [0-9]{3}L?|ITE [0-9]{1,2}L?|CFE [0-9]{3}[A-Z]?|FOR LANG [0-9]+|MMAE [0-9]{1,2}[A-Z]?)"
)


def list_class_schedules(db: Session) -> list[ClassSchedule]:
    return list(
        db.scalars(
            select(ClassSchedule).order_by(
                ClassSchedule.room_code,
                ClassSchedule.day_of_week,
                ClassSchedule.start_time,
            )
        ).all()
    )


def _validated_schedule_values(
    db: Session,
    payload: ClassScheduleFields,
    day_of_week: int,
) -> dict:
    room_code = payload.room_code.strip().upper()
    class_code = payload.class_code.strip().upper()
    course_number = " ".join(payload.course_number.upper().split())
    course_name = payload.course_name.strip()
    instructor = db.get(User, payload.instructor_id)

    if room_code not in CLASSROOM_CODES:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Unknown classroom")
    if not course_name:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Course name is required")
    if not class_code:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Class code is required")
    if not CLASS_CODE_PATTERN.fullmatch(class_code):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Class code must be four digits followed by A or B, or exactly five digits.",
        )
    if not course_number:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Course number is required")
    if not COURSE_NUMBER_PATTERN.fullmatch(course_number):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "Use a course code such as IT 111, IT 111L, CS 213, ITE 15, "
                "CFE 106A, FOR LANG 1, or MMAE 15."
            ),
        )
    if (
        not instructor
        or instructor.role != UserRole.INSTRUCTOR
        or not instructor.is_active
        or instructor.deactivated_at is not None
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Select an active instructor account",
        )
    if not 0 <= day_of_week <= 5:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid schedule day")
    if payload.start_time >= payload.end_time:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Schedule end time must be after its start time",
        )

    return {
        "room_code": room_code,
        "day_of_week": day_of_week,
        "start_time": payload.start_time,
        "end_time": payload.end_time,
        "class_code": class_code,
        "course_number": course_number,
        "course_name": course_name,
        "instructor_id": instructor.id,
        "instructor_name": instructor.full_name,
    }


def _persist_class_schedules(db: Session, values_list: list[dict], actor: User) -> list[ClassSchedule]:
    schedule_group_id = str(uuid4())
    schedules = [
        ClassSchedule(**values, schedule_group_id=schedule_group_id)
        for values in values_list
    ]
    db.add_all(schedules)
    db.flush()
    for schedule in schedules:
        db.add(
            AuditLog(
                actor_id=actor.id,
                action="CLASS_SCHEDULE_CREATED",
                entity_type="class_schedule",
                entity_id=schedule.id,
                details=(
                    f"Added {schedule.class_code} {schedule.course_number} "
                    f"on day {schedule.day_of_week} in {schedule.room_code}"
                ),
            )
        )
    db.commit()
    return schedules


def _ensure_no_schedule_conflict(
    db: Session,
    values: dict,
    exclude_id: int | None = None,
    exclude_ids: set[int] | None = None,
) -> None:
    excluded_ids = set(exclude_ids or ())
    if exclude_id is not None:
        excluded_ids.add(exclude_id)

    duplicate_query = select(ClassSchedule).where(
        ClassSchedule.room_code == values["room_code"],
        ClassSchedule.day_of_week == values["day_of_week"],
        ClassSchedule.start_time == values["start_time"],
        ClassSchedule.end_time == values["end_time"],
        ClassSchedule.class_code == values["class_code"],
        ClassSchedule.course_number == values["course_number"],
    )
    if excluded_ids:
        duplicate_query = duplicate_query.where(
            ClassSchedule.id.not_in(excluded_ids)
        )
    if db.scalar(duplicate_query):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "There is a schedule already for this class code and course code "
                "at the selected time. Delete it from the schedule chart before adding it again."
            ),
        )

    query = select(ClassSchedule).where(
        ClassSchedule.room_code == values["room_code"],
        ClassSchedule.day_of_week == values["day_of_week"],
        ClassSchedule.start_time < values["end_time"],
        ClassSchedule.end_time > values["start_time"],
    )
    if excluded_ids:
        query = query.where(ClassSchedule.id.not_in(excluded_ids))
    if db.scalar(query):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This classroom already has a schedule during that time",
        )


def create_class_schedule(db: Session, payload: ClassScheduleCreate, actor: User) -> ClassSchedule:
    values = _validated_schedule_values(db, payload, payload.day_of_week)
    _ensure_no_schedule_conflict(db, values)
    schedule = _persist_class_schedules(db, [values], actor)[0]
    db.refresh(schedule)
    return schedule


def create_class_schedules(
    db: Session,
    payload: ClassScheduleBulkCreate,
    actor: User,
) -> list[ClassSchedule]:
    if len(set(payload.days_of_week)) != len(payload.days_of_week):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Schedule days must not contain duplicates",
        )

    values_list = []
    for day_of_week in sorted(payload.days_of_week):
        values = _validated_schedule_values(db, payload, day_of_week)
        _ensure_no_schedule_conflict(db, values)
        values_list.append(values)
    return _persist_class_schedules(db, values_list, actor)


def update_class_schedule(
    db: Session,
    schedule_id: int,
    payload: ClassScheduleCreate,
    actor: User,
) -> ClassSchedule:
    schedule = db.get(ClassSchedule, schedule_id)
    if not schedule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule entry not found")

    schedules = (
        list(
            db.scalars(
                select(ClassSchedule).where(
                    ClassSchedule.schedule_group_id == schedule.schedule_group_id
                )
            ).all()
        )
        if schedule.schedule_group_id
        else [schedule]
    )
    schedule_ids = {entry.id for entry in schedules}
    schedule_group_id = schedule.schedule_group_id or str(uuid4())
    validated_values = [
        _validated_schedule_values(
            db,
            payload,
            payload.day_of_week if len(schedules) == 1 else entry.day_of_week,
        )
        for entry in schedules
    ]
    for values in validated_values:
        _ensure_no_schedule_conflict(db, values, exclude_ids=schedule_ids)

    for entry, values in zip(schedules, validated_values, strict=True):
        for field, value in values.items():
            setattr(entry, field, value)
        entry.schedule_group_id = schedule_group_id
        db.add(entry)
        db.add(
            AuditLog(
                actor_id=actor.id,
                action="CLASS_SCHEDULE_UPDATED",
                entity_type="class_schedule",
                entity_id=entry.id,
                details=(
                    f"Updated {entry.class_code} {entry.course_number} "
                    f"in {entry.room_code}"
                ),
            )
        )
    db.commit()
    db.refresh(schedule)
    return schedule


def update_class_schedule_days(
    db: Session,
    schedule_id: int,
    payload: ClassScheduleBulkCreate,
    actor: User,
) -> list[ClassSchedule]:
    schedule = db.get(ClassSchedule, schedule_id)
    if not schedule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule entry not found")
    if len(set(payload.days_of_week)) != len(payload.days_of_week):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Schedule days must not contain duplicates",
        )

    group_id = schedule.schedule_group_id or str(uuid4())
    group_schedules = list(
        db.scalars(
            select(ClassSchedule)
            .where(ClassSchedule.schedule_group_id == group_id)
            .order_by(ClassSchedule.day_of_week)
        ).all()
    )
    if not group_schedules:
        group_schedules = [schedule]
    existing_by_day = {entry.day_of_week: entry for entry in group_schedules}
    group_schedule_ids = {entry.id for entry in group_schedules}

    values_list = [
        _validated_schedule_values(db, payload, day_of_week)
        for day_of_week in sorted(payload.days_of_week)
    ]
    for values in values_list:
        _ensure_no_schedule_conflict(db, values, exclude_ids=group_schedule_ids)

    updated_schedules = []
    created_schedules = []
    retained_schedule_ids = set()
    selected_days = {values["day_of_week"] for values in values_list}
    reuse_primary_schedule = schedule.day_of_week not in selected_days
    for values in values_list:
        existing = existing_by_day.get(values["day_of_week"])
        if existing and existing.id in retained_schedule_ids:
            existing = None
        if (
            existing is None
            and reuse_primary_schedule
            and schedule.id not in retained_schedule_ids
        ):
            existing = schedule
        if existing:
            for field, value in values.items():
                setattr(existing, field, value)
            existing.schedule_group_id = group_id
            db.add(existing)
            updated_schedules.append(existing)
            retained_schedule_ids.add(existing.id)
        else:
            created = ClassSchedule(**values, schedule_group_id=group_id)
            db.add(created)
            created_schedules.append(created)

    removed_schedules = [
        entry for entry in group_schedules if entry.id not in retained_schedule_ids
    ]
    for removed in removed_schedules:
        db.add(
            AuditLog(
                actor_id=actor.id,
                action="CLASS_SCHEDULE_DELETED",
                entity_type="class_schedule",
                entity_id=removed.id,
                details=(
                    f"Removed {removed.class_code} {removed.course_number} "
                    f"from {removed.room_code} as part of a grouped schedule update"
                ),
            )
        )
        db.delete(removed)

    db.flush()
    for updated in updated_schedules:
        db.add(
            AuditLog(
                actor_id=actor.id,
                action="CLASS_SCHEDULE_UPDATED",
                entity_type="class_schedule",
                entity_id=updated.id,
                details=(
                    f"Updated {updated.class_code} {updated.course_number} "
                    f"on day {updated.day_of_week} in {updated.room_code}"
                ),
            )
        )
    for created in created_schedules:
        db.add(
            AuditLog(
                actor_id=actor.id,
                action="CLASS_SCHEDULE_CREATED",
                entity_type="class_schedule",
                entity_id=created.id,
                details=(
                    f"Added {created.class_code} {created.course_number} "
                    f"on day {created.day_of_week} in {created.room_code}"
                ),
            )
        )
    db.commit()
    schedules = [*updated_schedules, *created_schedules]
    for entry in schedules:
        db.refresh(entry)
    return sorted(schedules, key=lambda entry: entry.day_of_week)


def delete_class_schedule(db: Session, schedule_id: int, actor: User) -> None:
    schedule = db.get(ClassSchedule, schedule_id)
    if not schedule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule entry not found")

    schedules = (
        list(
            db.scalars(
                select(ClassSchedule).where(
                    ClassSchedule.schedule_group_id == schedule.schedule_group_id
                )
            ).all()
        )
        if schedule.schedule_group_id
        else [schedule]
    )
    for entry in schedules:
        db.add(
            AuditLog(
                actor_id=actor.id,
                action="CLASS_SCHEDULE_DELETED",
                entity_type="class_schedule",
                entity_id=entry.id,
                details=f"Removed {entry.class_code} {entry.course_number} from {entry.room_code}",
            )
        )
        db.delete(entry)
    db.commit()
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