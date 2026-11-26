from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.permissions import get_current_user, require_role
from app.db.session import get_db
from app.features.sessions import service
from app.features.sessions.schemas import (
    ClassScheduleBulkCreate,
    ClassScheduleCreate,
    ClassScheduleResponse,
    SessionResponse,
    SessionStartRequest,
    StationCheckInRequest,
    StationLogResponse,
)
from app.features.users.models import User, UserRole

router = APIRouter(prefix="/sessions", tags=["Lab Monitoring & Sessions"])


@router.get("/schedules", response_model=list[ClassScheduleResponse])
def list_class_schedules(
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.list_class_schedules(db)


@router.post("/schedules", response_model=ClassScheduleResponse, status_code=201)
def create_class_schedule(
    payload: ClassScheduleCreate,
    current_user: User = Depends(require_role(UserRole.DEPT_HEAD)),
    db: Session = Depends(get_db),
):
    return service.create_class_schedule(db, payload, current_user)


@router.post("/schedules/bulk", response_model=list[ClassScheduleResponse], status_code=201)
def create_class_schedules(
    payload: ClassScheduleBulkCreate,
    current_user: User = Depends(require_role(UserRole.DEPT_HEAD)),
    db: Session = Depends(get_db),
):
    return service.create_class_schedules(db, payload, current_user)


@router.put("/schedules/{schedule_id}", response_model=ClassScheduleResponse)
def update_class_schedule(
    schedule_id: int,
    payload: ClassScheduleCreate,
    current_user: User = Depends(require_role(UserRole.DEPT_HEAD)),
    db: Session = Depends(get_db),
):
    return service.update_class_schedule(db, schedule_id, payload, current_user)


@router.put("/schedules/{schedule_id}/days", response_model=list[ClassScheduleResponse])
def update_class_schedule_days(
    schedule_id: int,
    payload: ClassScheduleBulkCreate,
    current_user: User = Depends(require_role(UserRole.DEPT_HEAD)),
    db: Session = Depends(get_db),
):
    return service.update_class_schedule_days(db, schedule_id, payload, current_user)


@router.delete("/schedules/{schedule_id}", status_code=204)
def delete_class_schedule(
    schedule_id: int,
    current_user: User = Depends(require_role(UserRole.DEPT_HEAD)),
    db: Session = Depends(get_db),
):
    service.delete_class_schedule(db, schedule_id, current_user)


@router.post("", response_model=SessionResponse, status_code=201)
def start_session(
    payload: SessionStartRequest,
    current_user: User = Depends(require_role(UserRole.INSTRUCTOR, UserRole.CUSTODIAN, UserRole.TRIL_ADMIN)),
    db: Session = Depends(get_db),
):
    return service.start_class_session(db, payload, current_user)


@router.post("/{session_id}/end", response_model=SessionResponse)
def end_session(
    session_id: int,
    _: User = Depends(require_role(UserRole.INSTRUCTOR, UserRole.CUSTODIAN, UserRole.TRIL_ADMIN)),
    db: Session = Depends(get_db),
):
    return service.end_class_session(db, session_id)


@router.post("/check-in", response_model=StationLogResponse, status_code=201)
def student_check_in(
    payload: StationCheckInRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.check_in_station(db, payload.qr_code, current_user)


@router.post("/check-out", response_model=StationLogResponse)
def student_check_out(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.check_out_station(db, current_user)


@router.get("/my-active", response_model=StationLogResponse | None)
def my_active_station(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.get_my_active_station(db, current_user)