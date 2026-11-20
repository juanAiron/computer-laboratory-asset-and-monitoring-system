from datetime import datetime
from pydantic import BaseModel


class SessionStartRequest(BaseModel):
    lab_room_id: int
    course_code: str | None = None


class SessionResponse(BaseModel):
    id: int
    lab_room_id: int
    instructor_id: int | None
    course_code: str | None
    started_at: datetime
    ended_at: datetime | None

    model_config = {"from_attributes": True}


class StationCheckInRequest(BaseModel):
    qr_code: str


class StationLogResponse(BaseModel):
    id: int
    session_id: int | None
    station_id: int
    station_number: str
    lab_code: str
    student_id: int
    time_in: datetime
    time_out: datetime | None