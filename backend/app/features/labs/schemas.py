from pydantic import BaseModel, Field


class LabRoomCreate(BaseModel):
    code: str = Field(min_length=4, max_length=10)
    name: str = Field(min_length=1, max_length=100)
    schedule_button_label: str | None = Field(default=None, max_length=100)
    building: str | None = Field(default=None, max_length=100)
    capacity: int = Field(default=40, gt=0)


class LabRoomResponse(BaseModel):
    id: int
    code: str
    name: str
    schedule_button_label: str | None
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