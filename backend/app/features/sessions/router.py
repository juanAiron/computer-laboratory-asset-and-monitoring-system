from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.permissions import get_current_user, require_role
from app.db.session import get_db
from app.features.sessions import service
from app.features.sessions.schemas import (
    SessionResponse,
    SessionStartRequest,
    StationCheckInRequest,
    StationLogResponse,
)
from app.features.users.models import User, UserRole

router = APIRouter(prefix="/sessions", tags=["Lab Monitoring & Sessions"])


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