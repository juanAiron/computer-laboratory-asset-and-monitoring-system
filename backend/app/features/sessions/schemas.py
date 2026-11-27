from datetime import datetime, time

from pydantic import BaseModel, Field

from app.features.users.schemas import InstructorSummary


class ScheduleInstructorSummary(InstructorSummary):
    email: str


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


class ClassScheduleFields(BaseModel):
    room_code: str = Field(min_length=4, max_length=10)
    start_time: time
    end_time: time
    instructor_id: int = Field(gt=0)
    class_code: str = Field(min_length=1, max_length=50)
    course_number: str = Field(min_length=1, max_length=50)
    course_name: str = Field(min_length=1, max_length=100)


class ClassScheduleCreate(ClassScheduleFields):
    day_of_week: int = Field(ge=0, le=5)


class ClassScheduleBulkCreate(ClassScheduleFields):
    days_of_week: list[int] = Field(min_length=1, max_length=6)


class ClassScheduleResponse(ClassScheduleFields):
    id: int
    day_of_week: int
    schedule_group_id: str | None = None
    class_code: str | None = None
    course_number: str | None = None
    instructor_id: int | None = None
    instructor_name: str | None = None
    instructor: ScheduleInstructorSummary | None = Field(
        default=None,
        validation_alias="visible_instructor",
    )

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