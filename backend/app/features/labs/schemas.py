from pydantic import BaseModel


class LabRoomCreate(BaseModel):
    code: str
    name: str
    building: str | None = None
    capacity: int = 40


class LabRoomResponse(BaseModel):
    id: int
    code: str
    name: str
    building: str | None
    capacity: int
    is_active: bool

    model_config = {"from_attributes": True}


class LabStationCreate(BaseModel):
    station_number: str
    qr_code: str | None = None
    is_operational: bool = True


class StationOccupancyOut(BaseModel):
    id: int
    station_number: str
    qr_code: str
    is_operational: bool
    status: str  # "available" | "occupied" | "offline"
    occupant_name: str | None = None
    occupant_id_number: str | None = None
    active_log_id: int | None = None


class LabRoomDetailResponse(LabRoomResponse):
    stations: list[StationOccupancyOut]