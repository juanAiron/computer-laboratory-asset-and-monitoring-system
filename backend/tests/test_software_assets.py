import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.core.permissions import get_current_user
from app.db.base import Base
from app.db.session import get_db
from app.features.software_assets.models import SoftwareAsset, SoftwareStatus
from app.features.software_assets.router import router as software_assets_router
from app.features.users.models import User, UserRole


@pytest.fixture
def software_api():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    db = Session(engine)
    users = {
        role: User(
            email=f"{role.value}@example.test",
            full_name=role.value.replace("_", " ").title(),
            role=role,
        )
        for role in (
            UserRole.SUPER_ADMIN,
            UserRole.TRIL_ADMIN,
            UserRole.DEPT_HEAD,
            UserRole.CUSTODIAN,
            UserRole.STUDENT,
        )
    }
    db.add_all(users.values())
    db.flush()
    software_asset = SoftwareAsset(
        product_name="Office Suite",
        vendor="Example Vendor",
        version="2026",
        license_type="subscription",
        license_count=20,
        assigned_to="Computer Lab 1",
        status=SoftwareStatus.ACTIVE,
    )
    db.add(software_asset)
    db.commit()
    db.refresh(software_asset)

    active_user = {"user": users[UserRole.STUDENT]}
    app = FastAPI()
    app.include_router(software_assets_router, prefix="/api/v1")
    app.dependency_overrides[get_current_user] = lambda: active_user["user"]
    app.dependency_overrides[get_db] = lambda: db

    with TestClient(app) as client:
        yield client, active_user, users, software_asset

    db.close()
    Base.metadata.drop_all(engine)
    engine.dispose()


def test_software_inventory_is_readable_by_inventory_roles_only(software_api):
    client, active_user, users, _ = software_api
    for role in (UserRole.TRIL_ADMIN, UserRole.DEPT_HEAD, UserRole.CUSTODIAN):
        active_user["user"] = users[role]
        response = client.get("/api/v1/software-assets")
        assert response.status_code == 200
        assert response.json()[0]["product_name"] == "Office Suite"

    active_user["user"] = users[UserRole.STUDENT]
    assert client.get("/api/v1/software-assets").status_code == 403


def test_custodian_can_edit_software_and_legacy_requests_remain_reviewable(software_api):
    client, active_user, users, software_asset = software_api
    active_user["user"] = users[UserRole.CUSTODIAN]

    direct_update = client.patch(
        f"/api/v1/software-assets/{software_asset.id}",
        json={"license_count": 25},
    )
    assert direct_update.status_code == 200
    assert direct_update.json()["license_count"] == 25

    request = client.post(
        f"/api/v1/software-assets/{software_asset.id}/edit-requests",
        json={
            "changes": {"license_count": 25, "renewal_date": "2027-01-01"},
            "reason": "The department renewed five additional seats.",
        },
    )
    assert request.status_code == 201
    request_id = request.json()["id"]

    active_user["user"] = users[UserRole.DEPT_HEAD]
    assert client.get("/api/v1/software-assets/edit-requests").status_code == 403

    active_user["user"] = users[UserRole.SUPER_ADMIN]
    pending = client.get(
        "/api/v1/software-assets/edit-requests",
        params={"status_filter": "pending"},
    )
    assert pending.status_code == 200
    assert [entry["id"] for entry in pending.json()] == [request_id]

    approved = client.post(
        f"/api/v1/software-assets/edit-requests/{request_id}/approve",
        json={},
    )
    assert approved.status_code == 200
    assert approved.json()["status"] == "approved"
    updated = client.get("/api/v1/software-assets").json()[0]
    assert updated["license_count"] == 25
    assert updated["renewal_date"] == "2027-01-01"


def test_custodian_and_super_admin_can_create_software_records(software_api):
    client, active_user, users, _ = software_api
    payload = {
        "product_name": "Design Tool",
        "vendor": "Example Vendor",
        "license_type": "perpetual",
        "license_count": 5,
    }
    active_user["user"] = users[UserRole.CUSTODIAN]
    created_by_custodian = client.post("/api/v1/software-assets", json=payload)
    assert created_by_custodian.status_code == 201
    assert created_by_custodian.json()["product_name"] == "Design Tool"

    active_user["user"] = users[UserRole.SUPER_ADMIN]
    created = client.post(
        "/api/v1/software-assets",
        json={**payload, "product_name": "Design Tool Admin"},
    )
    assert created.status_code == 201
    assert created.json()["product_name"] == "Design Tool Admin"
    assert created.json()["currency_code"] == "PHP"


def test_department_head_and_tril_advisor_cannot_modify_software(software_api):
    client, active_user, users, software_asset = software_api
    for role in (UserRole.DEPT_HEAD, UserRole.TRIL_ADMIN):
        active_user["user"] = users[role]
        assert client.get("/api/v1/software-assets").status_code == 200
        assert client.patch(
            f"/api/v1/software-assets/{software_asset.id}",
            json={"license_count": 25},
        ).status_code == 403
        assert client.post(
            "/api/v1/software-assets",
            json={
                "product_name": "Blocked Tool",
                "vendor": "Example Vendor",
                "license_type": "subscription",
            },
        ).status_code == 403
        assert client.post(f"/api/v1/software-assets/{software_asset.id}/archive").status_code == 403


def test_custodian_can_archive_software_and_archived_records_are_hidden(software_api):
    client, active_user, users, software_asset = software_api
    active_user["user"] = users[UserRole.CUSTODIAN]

    archived = client.post(f"/api/v1/software-assets/{software_asset.id}/archive")

    assert archived.status_code == 200
    assert client.get("/api/v1/software-assets").json() == []
    assert client.patch(
        f"/api/v1/software-assets/{software_asset.id}",
        json={"license_count": 25},
    ).status_code == 404
