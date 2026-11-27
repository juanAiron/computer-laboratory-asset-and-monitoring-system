from datetime import time

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.core.permissions import get_current_user
from app.db.base import Base
from app.db.session import get_db
from app.features.labs.models import LabRoom
from app.features.labs.router import router as labs_router
from app.features.sessions.router import router as sessions_router
from app.features.sessions.schemas import ClassScheduleResponse
from app.features.users.models import User, UserRole
from app.features.users.router import router as users_router


@pytest.fixture
def schedule_api():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    db = Session(engine)
    department_head = User(
        email="head@example.test",
        full_name="Department Head",
        role=UserRole.DEPT_HEAD,
    )
    student = User(
        email="student@example.test",
        full_name="Student",
        role=UserRole.STUDENT,
    )
    instructor = User(
        email="instructor@example.test",
        full_name="Instructor One",
        role=UserRole.INSTRUCTOR,
        profile_photo_url="/uploads/profiles/instructor.png",
        department="Computer Studies",
        office="D522",
    )
    inactive_instructor = User(
        email="inactive-instructor@example.test",
        full_name="Inactive Instructor",
        role=UserRole.INSTRUCTOR,
        is_active=False,
    )
    super_admin = User(
        email="admin@example.test",
        full_name="Super Admin",
        role=UserRole.SUPER_ADMIN,
    )
    schedule_rooms = [
        LabRoom(code=code, name=name)
        for code, name in (
            ("D522", "D522"),
            ("D524", "D524"),
            ("D526", "D526"),
            ("D528", "D528"),
            ("D422", "D422"),
            ("D427-CR", "Conference Room"),
            ("D427-PL", "Photo Lab"),
            ("D428-SL", "Sound Lab"),
            ("D424-KC", "Knowledge Center"),
            ("D426-OL", "Open Laboratory"),
            ("D223", "D223"),
            ("D722", "D722"),
            ("D723", "D723"),
            ("D724", "D724"),
            ("D725", "D725"),
        )
    ]
    db.add_all([department_head, student, instructor, inactive_instructor, super_admin, *schedule_rooms])
    db.commit()

    active_user = {"user": student, "super_admin": super_admin}
    app = FastAPI()
    app.include_router(labs_router, prefix="/api/v1")
    app.include_router(sessions_router, prefix="/api/v1")
    app.include_router(users_router, prefix="/api/v1")
    app.dependency_overrides[get_current_user] = lambda: active_user["user"]
    app.dependency_overrides[get_db] = lambda: db

    with TestClient(app) as client:
        yield client, active_user, department_head, instructor, inactive_instructor

    db.close()
    Base.metadata.drop_all(engine)
    engine.dispose()


def test_department_head_can_manage_schedules_but_student_cannot(schedule_api):
    client, active_user, department_head, instructor, _ = schedule_api
    schedule = {
        "room_code": "D522",
        "day_of_week": 0,
        "start_time": "08:30",
        "end_time": "09:30",
        "instructor_id": instructor.id,
        "class_code": "9446A",
        "course_number": "IT 411",
        "course_name": "IT 411",
    }

    schedule_days = {**schedule, "days_of_week": [0, 2, 4]}
    denied = client.post("/api/v1/sessions/schedules/bulk", json=schedule_days)
    assert denied.status_code == 403

    active_user["user"] = department_head
    created = client.post("/api/v1/sessions/schedules/bulk", json=schedule_days)
    assert created.status_code == 201
    assert [entry["day_of_week"] for entry in created.json()] == [0, 2, 4]
    assert all(entry["room_code"] == "D522" for entry in created.json())
    assert all(entry["class_code"] == "9446A" for entry in created.json())
    assert all(entry["course_number"] == "IT 411" for entry in created.json())
    assert all(entry["course_name"] == "IT 411" for entry in created.json())
    assert all(entry["instructor"]["full_name"] == instructor.full_name for entry in created.json())
    assert all(entry["instructor"]["email"] == instructor.email for entry in created.json())
    assert all(entry["instructor"]["profile_photo_url"] == instructor.profile_photo_url for entry in created.json())
    assert all(entry["instructor"]["department"] == instructor.department for entry in created.json())
    assert all(entry["instructor"]["office"] == instructor.office for entry in created.json())

    conflict = client.post(
        "/api/v1/sessions/schedules/bulk",
        json={
            **schedule,
            "days_of_week": [1, 2],
            "start_time": "09:00",
            "end_time": "10:00",
        },
    )
    assert conflict.status_code == 409
    listed = client.get("/api/v1/sessions/schedules")
    assert [entry["day_of_week"] for entry in listed.json()] == [0, 2, 4]

    updated = client.put(
        f"/api/v1/sessions/schedules/{created.json()[0]['id']}",
        json={**schedule, "day_of_week": 0, "start_time": "09:30", "end_time": "10:30"},
    )
    assert updated.status_code == 200
    assert updated.json()["start_time"].startswith("09:30")
    updated_group = client.get("/api/v1/sessions/schedules").json()
    assert len(updated_group) == 3
    assert all(entry["start_time"].startswith("09:30") for entry in updated_group)

    deleted = client.delete(f"/api/v1/sessions/schedules/{created.json()[0]['id']}")
    assert deleted.status_code == 204


@pytest.mark.parametrize(
    "room_code",
    ["D427-CR", "D427-PL", "D428-SL", "D424-KC", "D426-OL"],
)
def test_department_head_can_schedule_new_fourth_floor_rooms(schedule_api, room_code):
    client, active_user, department_head, instructor, _ = schedule_api
    active_user["user"] = department_head

    created = client.post(
        "/api/v1/sessions/schedules/bulk",
        json={
            "room_code": room_code,
            "days_of_week": [0],
            "start_time": "08:30",
            "end_time": "09:30",
            "instructor_id": instructor.id,
            "class_code": "9446A",
            "course_number": "IT 411",
            "course_name": "IT 411",
        },
    )

    assert created.status_code == 201
    assert created.json()[0]["room_code"] == room_code


def test_only_super_admin_can_add_rooms_available_for_scheduling(schedule_api):
    client, active_user, department_head, instructor, _ = schedule_api
    room = {"code": "D999", "name": "New Lab", "capacity": 30}

    active_user["user"] = department_head
    assert client.post("/api/v1/labs", json=room).status_code == 403
    assert client.post(
        "/api/v1/sessions/schedules/bulk",
        json={
            "room_code": "D999",
            "days_of_week": [0],
            "start_time": "08:30",
            "end_time": "09:30",
            "instructor_id": instructor.id,
            "class_code": "9446A",
            "course_number": "IT 411",
            "course_name": "IT 411",
        },
    ).status_code == 422

    active_user["user"] = active_user["super_admin"]
    created_room = client.post("/api/v1/labs", json=room)
    assert created_room.status_code == 201

    active_user["user"] = department_head
    created_schedule = client.post(
        "/api/v1/sessions/schedules/bulk",
        json={
            "room_code": "D999",
            "days_of_week": [0],
            "start_time": "08:30",
            "end_time": "09:30",
            "instructor_id": instructor.id,
            "class_code": "9446A",
            "course_number": "IT 411",
            "course_name": "IT 411",
        },
    )
    assert created_schedule.status_code == 201
    assert created_schedule.json()[0]["room_code"] == "D999"


def test_instructor_profile_endpoint_hides_private_and_non_instructor_accounts(schedule_api):
    client, active_user, _, instructor, inactive_instructor = schedule_api

    profile = client.get(f"/api/v1/users/instructors/{instructor.id}")
    assert profile.status_code == 200
    assert profile.json()["full_name"] == instructor.full_name
    assert profile.json()["email"] == instructor.email

    instructor.profile_visibility = "private"
    private_profile = client.get(f"/api/v1/users/instructors/{instructor.id}")
    assert private_profile.status_code == 404

    inactive_profile = client.get(
        f"/api/v1/users/instructors/{inactive_instructor.id}"
    )
    assert inactive_profile.status_code == 404

    non_instructor_profile = client.get(
        f"/api/v1/users/instructors/{active_user['user'].id}"
    )
    assert non_instructor_profile.status_code == 404


def test_identical_schedule_requires_deleting_existing_entry(schedule_api):
    client, active_user, department_head, instructor, _ = schedule_api
    active_user["user"] = department_head
    schedule = {
        "room_code": "D522",
        "days_of_week": [0],
        "start_time": "08:00",
        "end_time": "09:00",
        "instructor_id": instructor.id,
        "class_code": "9446A",
        "course_number": "IT 411",
        "course_name": "Applications Development",
    }

    created = client.post("/api/v1/sessions/schedules/bulk", json=schedule)
    assert created.status_code == 201

    duplicate = client.post(
        "/api/v1/sessions/schedules/bulk",
        json={**schedule, "class_code": "9446a", "course_number": "it 411"},
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["detail"] == (
        "There is a schedule already for this class code and course code "
        "at the selected time. Delete it from the schedule chart before adding it again."
    )
    listed = client.get("/api/v1/sessions/schedules")
    assert [entry["id"] for entry in listed.json()] == [created.json()[0]["id"]]

    deleted = client.delete(
        f"/api/v1/sessions/schedules/{created.json()[0]['id']}",
    )
    assert deleted.status_code == 204
    recreated = client.post("/api/v1/sessions/schedules/bulk", json=schedule)
    assert recreated.status_code == 201


def test_department_head_can_edit_one_schedule_into_multiple_days(schedule_api):
    client, active_user, department_head, instructor, _ = schedule_api
    active_user["user"] = department_head
    schedule = {
        "room_code": "D522",
        "days_of_week": [0],
        "start_time": "08:00",
        "end_time": "09:00",
        "instructor_id": instructor.id,
        "class_code": "9446A",
        "course_number": "IT 411",
        "course_name": "Applications Development",
    }
    created = client.post("/api/v1/sessions/schedules/bulk", json=schedule)
    assert created.status_code == 201
    schedule_id = created.json()[0]["id"]

    blocker = client.post(
        "/api/v1/sessions/schedules/bulk",
        json={
            **schedule,
            "days_of_week": [3],
            "class_code": "9450A",
            "course_number": "IT 412",
        },
    )
    assert blocker.status_code == 201
    conflict = client.put(
        f"/api/v1/sessions/schedules/{schedule_id}/days",
        json={**schedule, "days_of_week": [1, 3], "end_time": "09:30"},
    )
    assert conflict.status_code == 409
    listed_after_conflict = client.get("/api/v1/sessions/schedules")
    assert [entry["day_of_week"] for entry in listed_after_conflict.json()] == [0, 3]
    assert listed_after_conflict.json()[0]["end_time"].startswith("09:00")
    assert (
        client.delete(f"/api/v1/sessions/schedules/{blocker.json()[0]['id']}").status_code
        == 204
    )

    updated = client.put(
        f"/api/v1/sessions/schedules/{schedule_id}/days",
        json={**schedule, "days_of_week": [1, 3], "end_time": "09:30"},
    )

    assert updated.status_code == 200
    assert [entry["day_of_week"] for entry in updated.json()] == [1, 3]
    assert updated.json()[0]["id"] == schedule_id
    assert all(entry["end_time"].startswith("09:30") for entry in updated.json())
    listed = client.get("/api/v1/sessions/schedules")
    assert [entry["day_of_week"] for entry in listed.json()] == [1, 3]
    assert all(
        entry["schedule_group_id"] == updated.json()[0]["schedule_group_id"]
        for entry in listed.json()
    )


def test_editing_and_deleting_a_group_affects_every_created_day(schedule_api):
    client, active_user, department_head, instructor, _ = schedule_api
    active_user["user"] = department_head
    schedule = {
        "room_code": "D522",
        "days_of_week": [0, 2, 4],
        "start_time": "08:00",
        "end_time": "09:00",
        "instructor_id": instructor.id,
        "class_code": "9446A",
        "course_number": "IT 411",
        "course_name": "Applications Development",
    }

    created = client.post("/api/v1/sessions/schedules/bulk", json=schedule)
    assert created.status_code == 201
    group_id = created.json()[0]["schedule_group_id"]
    assert all(entry["schedule_group_id"] == group_id for entry in created.json())

    updated = client.put(
        f"/api/v1/sessions/schedules/{created.json()[1]['id']}/days",
        json={
            **schedule,
            "days_of_week": [1, 2, 3],
            "start_time": "09:00",
            "end_time": "10:00",
        },
    )
    assert updated.status_code == 200
    assert [entry["day_of_week"] for entry in updated.json()] == [1, 2, 3]
    assert all(entry["start_time"].startswith("09:00") for entry in updated.json())
    assert all(entry["schedule_group_id"] == group_id for entry in updated.json())

    deleted = client.delete(
        f"/api/v1/sessions/schedules/{updated.json()[1]['id']}",
    )
    assert deleted.status_code == 204
    assert client.get("/api/v1/sessions/schedules").json() == []


def test_schedule_response_supports_existing_entries_without_new_codes():
    schedule = ClassScheduleResponse(
        id=1,
        room_code="D522",
        day_of_week=0,
        start_time=time(8),
        end_time=time(9),
        class_code=None,
        course_number=None,
        course_name="IT 411",
        instructor_id=None,
        instructor_name=None,
    )

    assert schedule.class_code is None
    assert schedule.course_number is None


def test_department_head_can_only_select_active_instructor_accounts(schedule_api):
    client, active_user, department_head, instructor, inactive_instructor = schedule_api
    active_user["user"] = department_head

    instructors = client.get("/api/v1/users/instructors")
    assert instructors.status_code == 200
    assert [entry["id"] for entry in instructors.json()] == [instructor.id]
    assert instructors.json()[0]["profile_photo_url"] == instructor.profile_photo_url

    invalid_schedule = {
        "room_code": "D522",
        "days_of_week": [0],
        "start_time": "08:30",
        "end_time": "09:30",
        "instructor_id": inactive_instructor.id,
        "class_code": "9446A",
        "course_number": "IT 411",
        "course_name": "IT 411",
    }
    rejected = client.post("/api/v1/sessions/schedules/bulk", json=invalid_schedule)
    assert rejected.status_code == 422

    sunday_schedule = {**invalid_schedule, "days_of_week": [6], "instructor_id": instructor.id}
    rejected_sunday = client.post(
        "/api/v1/sessions/schedules/bulk",
        json=sunday_schedule,
    )
    assert rejected_sunday.status_code == 422


def test_private_instructor_details_are_hidden_from_schedule_cards(schedule_api):
    client, active_user, department_head, instructor, _ = schedule_api
    active_user["user"] = department_head
    instructor.profile_visibility = "private"

    response = client.post(
        "/api/v1/sessions/schedules/bulk",
        json={
            "room_code": "D522",
            "days_of_week": [0],
            "start_time": "08:30",
            "end_time": "09:30",
            "instructor_id": instructor.id,
            "class_code": "9446A",
            "course_number": "IT 411",
            "course_name": "IT 411",
        },
    )

    assert response.status_code == 201
    assert response.json()[0]["instructor"] is None


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("class_code", "asdfkjgwerfg231434"),
        ("class_code", "1234C"),
        ("course_number", "asdfkjgwerfg231434"),
        ("course_number", "IT 1111"),
    ],
)
def test_department_head_cannot_save_invalid_schedule_codes(schedule_api, field, value):
    client, active_user, department_head, instructor, _ = schedule_api
    active_user["user"] = department_head
    schedule = {
        "room_code": "D522",
        "days_of_week": [0],
        "start_time": "08:30",
        "end_time": "09:30",
        "instructor_id": instructor.id,
        "class_code": "9446A",
        "course_number": "IT 411",
        "course_name": "Applications Development",
    }
    schedule[field] = value

    response = client.post("/api/v1/sessions/schedules/bulk", json=schedule)

    assert response.status_code == 422


@pytest.mark.parametrize(
    ("class_code", "expected_class_code"),
    [("9446b", "9446B"), ("12345", "12345")],
)
def test_department_head_can_use_supported_class_code_formats(
    schedule_api,
    class_code,
    expected_class_code,
):
    client, active_user, department_head, instructor, _ = schedule_api
    active_user["user"] = department_head
    schedule = {
        "room_code": "D522",
        "days_of_week": [0],
        "start_time": "08:30",
        "end_time": "09:30",
        "instructor_id": instructor.id,
        "class_code": class_code,
        "course_number": "IT 411",
        "course_name": "Test course",
    }

    response = client.post("/api/v1/sessions/schedules/bulk", json=schedule)

    assert response.status_code == 201
    assert response.json()[0]["class_code"] == expected_class_code


@pytest.mark.parametrize(
    "course_number",
    [
        "IT 111",
        "IT 111L",
        "CS 213",
        "ITE 17L",
        "CFE 106A",
        "FOR LANG 1",
        "MMAE 15",
    ],
)
def test_department_head_can_use_supported_course_number_formats(schedule_api, course_number):
    client, active_user, department_head, instructor, _ = schedule_api
    active_user["user"] = department_head
    schedule = {
        "room_code": "D522",
        "days_of_week": [0],
        "start_time": "08:30",
        "end_time": "09:30",
        "instructor_id": instructor.id,
        "class_code": "9446A",
        "course_number": course_number,
        "course_name": "Test course",
    }

    response = client.post("/api/v1/sessions/schedules/bulk", json=schedule)

    assert response.status_code == 201
    assert response.json()[0]["course_number"] == course_number
