import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.core.permissions import get_current_user
from app.db.base import Base
from app.db.session import get_db
from app.features.assets.models import Asset, AssetCondition, AssetStatus, Category
from app.features.counts.router import router as counts_router
from app.features.labs.models import LabRoom
from app.features.users.models import User, UserRole


@pytest.fixture
def inventory_count_api():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    db = Session(engine)
    custodian = User(
        email="custodian@example.test",
        full_name="Lab Custodian",
        role=UserRole.CUSTODIAN,
    )
    student = User(
        email="student@example.test",
        full_name="Student",
        role=UserRole.STUDENT,
    )
    lab = LabRoom(code="LAB-1", name="Computer Lab 1")
    category = Category(name="Computers")
    db.add_all([custodian, student, lab, category])
    db.flush()
    asset = Asset(
        asset_tag="PC-001",
        name="Lab computer",
        category_id=category.id,
        lab_room_id=lab.id,
        status=AssetStatus.AVAILABLE,
        condition=AssetCondition.GOOD,
    )
    db.add(asset)
    db.commit()

    active_user = {"user": student}
    app = FastAPI()
    app.include_router(counts_router, prefix="/api/v1")
    app.dependency_overrides[get_current_user] = lambda: active_user["user"]
    app.dependency_overrides[get_db] = lambda: db

    with TestClient(app) as client:
        yield client, active_user, custodian, lab, asset

    db.close()
    Base.metadata.drop_all(engine)
    engine.dispose()


def test_only_custodian_can_run_inventory_audits(inventory_count_api):
    client, active_user, custodian, lab, asset = inventory_count_api
    assert client.get("/api/v1/counts").status_code == 403

    active_user["user"] = User(
        email="tril@example.test",
        full_name="TRIL Adviser",
        role=UserRole.TRIL_ADMIN,
    )
    assert client.get("/api/v1/counts").status_code == 200
    assert client.post("/api/v1/counts", json={"lab_room_id": lab.id}).status_code == 403

    active_user["user"] = custodian
    started = client.post("/api/v1/counts", json={"lab_room_id": lab.id})
    assert started.status_code == 201
    count_id = started.json()["id"]

    listed = client.get("/api/v1/counts")
    assert listed.status_code == 200
    assert [count["id"] for count in listed.json()] == [count_id]
    assert listed.json()[0]["items"][0]["asset_tag"] == asset.asset_tag

    scanned = client.post(
        f"/api/v1/counts/{count_id}/scan",
        json={"asset_tag": asset.asset_tag},
    )
    assert scanned.status_code == 200
    assert scanned.json()["items"][0]["status"] == "found"
    assert asset.last_audited_at is not None

    closed = client.post(f"/api/v1/counts/{count_id}/close")
    assert closed.status_code == 200
    assert closed.json()["status"] == "completed"
    assert client.get("/api/v1/counts").json()[0]["status"] == "completed"
