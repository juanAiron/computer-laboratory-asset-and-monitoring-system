from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.permissions import get_current_user, require_role
from app.db.session import get_db
from app.features.labs import service
from app.features.labs.schemas import (
    LabRoomCreate,
    LabRoomDetailResponse,
    LabRoomResponse,
    LabStationCreate,
    StationOccupancyOut,
)
from app.features.users.models import User, UserRole

router = APIRouter(prefix="/labs", tags=["Laboratories"])


@router.get("", response_model=list[LabRoomResponse])
def list_labs(
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.list_labs(db)


@router.post("", response_model=LabRoomResponse, status_code=201)
def create_lab(
    payload: LabRoomCreate,
    current_user: User = Depends(require_role(UserRole.SUPER_ADMIN)),
    db: Session = Depends(get_db),
):
    return service.create_lab(db, payload, current_user)


@router.get("/{lab_id}/seat-map", response_model=LabRoomDetailResponse)
def get_lab_seat_map(
    lab_id: int,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.get_lab_seat_map(db, lab_id)


@router.post("/{lab_id}/stations", response_model=StationOccupancyOut, status_code=201)
def add_station(
    lab_id: int,
    payload: LabStationCreate,
    current_user: User = Depends(require_role(UserRole.TRIL_ADMIN, UserRole.CUSTODIAN)),
    db: Session = Depends(get_db),
):
    station = service.create_station(db, lab_id, payload, current_user)
    return StationOccupancyOut(
        id=station.id,
        station_number=station.station_number,
        qr_code=station.qr_code,
        is_operational=station.is_operational,
        status="available" if station.is_operational else "offline",
    )