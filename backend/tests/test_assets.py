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
from app.features.assets.router import router as assets_router
from app.features.users.models import User, UserRole


@pytest.fixture
def inventory_api():
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
    category = Category(name="Computers")
    db.add_all([*users.values(), category])
    db.flush()
    asset = Asset(
        asset_tag="PC-001",
        serial_number="SERIAL-001",
        name="Lab computer",
        brand_model="Example Model",
        category_id=category.id,
        status=AssetStatus.AVAILABLE,
        condition=AssetCondition.GOOD,
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)

    active_user = {"user": users[UserRole.STUDENT]}
    app = FastAPI()
    app.include_router(assets_router, prefix="/api/v1")
    app.dependency_overrides[get_current_user] = lambda: active_user["user"]
    app.dependency_overrides[get_db] = lambda: db

    with TestClient(app) as client:
        yield client, active_user, users, asset, category

    db.close()
    Base.metadata.drop_all(engine)
    engine.dispose()


def test_department_head_and_tril_advisor_are_view_only(inventory_api):
    client, active_user, users, asset, _ = inventory_api
    for role in (UserRole.TRIL_ADMIN, UserRole.DEPT_HEAD):
        active_user["user"] = users[role]
        assert client.get("/api/v1/assets").status_code == 200
        assert client.get("/api/v1/assets/categories").status_code == 200
        denied = client.patch(
            f"/api/v1/assets/{asset.id}",
            json={"name": "Unauthorized edit"},
        )
        assert denied.status_code == 403
        denied_create = client.post(
            "/api/v1/assets",
            json={"asset_tag": "PC-002", "name": "New item", "category_id": asset.category_id},
        )
        assert denied_create.status_code == 403

    active_user["user"] = users[UserRole.STUDENT]
    assert client.get("/api/v1/assets").status_code == 403


def test_custodian_and_super_admin_can_create_update_and_archive_hardware(inventory_api):
    client, active_user, users, asset, category = inventory_api
    for role, tag in ((UserRole.CUSTODIAN, "PC-002"), (UserRole.SUPER_ADMIN, "PC-003")):
        active_user["user"] = users[role]
        created = client.post(
            "/api/v1/assets",
            json={"asset_tag": tag, "name": "Added computer", "category_id": category.id},
        )
        assert created.status_code == 201
        asset_id = created.json()["id"]

        updated = client.patch(
            f"/api/v1/assets/{asset_id}",
            json={"name": "Updated computer"},
        )
        assert updated.status_code == 200
        assert updated.json()["name"] == "Updated computer"

        archived = client.post(f"/api/v1/assets/{asset_id}/archive")
        assert archived.status_code == 200

    active_user["user"] = users[UserRole.DEPT_HEAD]
    assert client.post(f"/api/v1/assets/{asset.id}/archive").status_code == 403
    assert [row["asset_tag"] for row in client.get("/api/v1/assets").json()] == ["PC-001"]


def test_super_admin_can_edit_hardware_directly(inventory_api):
    client, active_user, users, asset, _ = inventory_api
    active_user["user"] = users[UserRole.SUPER_ADMIN]
    updated = client.patch(
        f"/api/v1/assets/{asset.id}",
        json={"name": "Admin-edited computer"},
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Admin-edited computer"


def test_custodian_can_edit_asset_tag(inventory_api):
    client, active_user, users, asset, _ = inventory_api
    active_user["user"] = users[UserRole.CUSTODIAN]

    updated = client.patch(
        f"/api/v1/assets/{asset.id}",
        json={"asset_tag": " pc-renamed-001 "},
    )

    assert updated.status_code == 200
    assert updated.json()["asset_tag"] == "PC-RENAMED-001"


def test_asset_tag_edit_rejects_duplicates(inventory_api):
    client, active_user, users, asset, category = inventory_api
    active_user["user"] = users[UserRole.CUSTODIAN]
    created = client.post(
        "/api/v1/assets",
        json={"asset_tag": "PC-002", "name": "Second computer", "category_id": category.id},
    )
    assert created.status_code == 201

    duplicate = client.patch(
        f"/api/v1/assets/{asset.id}",
        json={"asset_tag": " pc-002 "},
    )

    assert duplicate.status_code == 409


def test_admin_can_update_hardware_register_fields(inventory_api):
    client, active_user, users, asset, _ = inventory_api
    active_user["user"] = users[UserRole.SUPER_ADMIN]

    updated = client.patch(
        f"/api/v1/assets/{asset.id}",
        json={
            "mac_address": "00:11:22:33:44:55",
            "operating_system": "Windows 11",
            "processor": "Intel Core i5",
            "ram": "16 GB",
            "storage": "512 GB SSD",
            "acquisition_date": "2025-08-15",
            "acquisition_cost": "42500.00",
            "assigned_department": "Computer Studies",
            "condition": "for_warranty",
            "status": "in_use",
            "comments": "Warranty valid through 2027.",
        },
    )

    assert updated.status_code == 200
    assert updated.json()["mac_address"] == "00:11:22:33:44:55"
    assert updated.json()["operating_system"] == "Windows 11"
    assert updated.json()["processor"] == "Intel Core i5"
    assert updated.json()["ram"] == "16 GB"
    assert updated.json()["storage"] == "512 GB SSD"
    assert updated.json()["acquisition_date"] == "2025-08-15"
    assert updated.json()["acquisition_cost"] == "42500.00"
    assert updated.json()["assigned_department"] == "Computer Studies"
    assert updated.json()["condition"] == "for_warranty"
    assert updated.json()["comments"] == "Warranty valid through 2027."


def test_legacy_custodian_change_requests_remain_reviewable(inventory_api):
    client, active_user, users, asset, _ = inventory_api
    active_user["user"] = users[UserRole.CUSTODIAN]
    created = client.post(
        f"/api/v1/assets/{asset.id}/edit-requests",
        json={
            "changes": {
                "condition": "for_replacement",
                "mac_address": "00:11:22:33:44:55",
                "acquisition_cost": "42500.00",
                "assigned_department": "Computer Studies",
            },
            "reason": "The computer has visible wear.",
        },
    )
    assert created.status_code == 201
    request_id = created.json()["id"]
    assert created.json()["status"] == "pending"

    mine = client.get("/api/v1/assets/edit-requests/mine")
    assert mine.status_code == 200
    assert [request["id"] for request in mine.json()] == [request_id]

    active_user["user"] = users[UserRole.TRIL_ADMIN]
    assert client.get("/api/v1/assets/edit-requests").status_code == 403

    active_user["user"] = users[UserRole.SUPER_ADMIN]
    pending = client.get("/api/v1/assets/edit-requests", params={"status_filter": "pending"})
    assert pending.status_code == 200
    assert [request["id"] for request in pending.json()] == [request_id]

    approved = client.post(f"/api/v1/assets/edit-requests/{request_id}/approve", json={})
    assert approved.status_code == 200
    assert approved.json()["status"] == "approved"
    assert approved.json()["reviewed_at"] is not None

    updated_asset = client.get("/api/v1/assets").json()[0]
    assert updated_asset["condition"] == "for_replacement"
    assert updated_asset["mac_address"] == "00:11:22:33:44:55"
    assert updated_asset["acquisition_cost"] == "42500.00"
    assert updated_asset["assigned_department"] == "Computer Studies"
    duplicate_review = client.post(
        f"/api/v1/assets/edit-requests/{request_id}/approve",
        json={},
    )
    assert duplicate_review.status_code == 409

    active_user["user"] = users[UserRole.CUSTODIAN]
    rejected_request = client.post(
        f"/api/v1/assets/{asset.id}/edit-requests",
        json={
            "changes": {"name": "Replacement computer"},
            "reason": "The current label may not match the device.",
        },
    )
    assert rejected_request.status_code == 201
    rejected_id = rejected_request.json()["id"]

    active_user["user"] = users[UserRole.SUPER_ADMIN]
    rejected = client.post(
        f"/api/v1/assets/edit-requests/{rejected_id}/reject",
        json={"note": "Please verify the asset tag first."},
    )
    assert rejected.status_code == 200
    assert rejected.json()["status"] == "rejected"
    assert rejected.json()["review_note"] == "Please verify the asset tag first."
    assert client.get("/api/v1/assets").json()[0]["name"] == "Lab computer"


def test_custodian_can_apply_inventory_changes_directly(inventory_api):
    client, active_user, users, asset, _ = inventory_api
    active_user["user"] = users[UserRole.CUSTODIAN]
    updated = client.patch(
        f"/api/v1/assets/{asset.id}",
        json={"condition": "defective"},
    )
    assert updated.status_code == 200
    assert updated.json()["condition"] == "defective"