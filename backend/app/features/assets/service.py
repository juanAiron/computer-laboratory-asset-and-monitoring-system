import uuid
from datetime import UTC, datetime
from pathlib import Path

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.features.assets.models import (
    Asset,
    AssetEditRequest,
    AssetEditRequestStatus,
    AssetStatus,
    Category,
)
from app.features.assets.schemas import (
    AssetCreate,
    AssetEditRequestCreate,
    AssetUpdate,
    CategoryCreate,
)
from app.features.users.models import User
from app.shared.audit import AuditLog

UPLOAD_DIR = Path("uploads/assets")
ALLOWED_IMAGE_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
MAX_IMAGE_BYTES = 5 * 1024 * 1024  # 5 MB


def list_categories(db: Session) -> list[Category]:
    return list(db.scalars(select(Category).order_by(Category.name.asc())).all())


def create_category(db: Session, payload: CategoryCreate) -> Category:
    name = payload.name.strip()
    if db.scalar(select(Category).where(Category.name.ilike(name))):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Category already exists")
    cat = Category(name=name, description=payload.description)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


def list_assets(
    db: Session,
    search: str | None = None,
    status_filter: AssetStatus | None = None,
    lab_room_id: int | None = None,
    category_id: int | None = None,
) -> list[Asset]:
    stmt = select(Asset).where(Asset.deactivated_at.is_(None)).order_by(Asset.asset_tag.asc())
    if status_filter:
        stmt = stmt.where(Asset.status == status_filter)
    if lab_room_id:
        stmt = stmt.where(Asset.lab_room_id == lab_room_id)
    if category_id:
        stmt = stmt.where(Asset.category_id == category_id)
    if search:
        pattern = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                Asset.asset_tag.ilike(pattern),
                Asset.serial_number.ilike(pattern),
                Asset.name.ilike(pattern),
                Asset.brand_model.ilike(pattern),
            )
        )
    return list(db.scalars(stmt).all())


def get_asset_by_tag(db: Session, tag: str) -> Asset:
    asset = db.scalar(
        select(Asset).where(Asset.asset_tag == tag.strip().upper(), Asset.deactivated_at.is_(None))
    )
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Asset tag '{tag}' not found")
    return asset


def create_asset(db: Session, payload: AssetCreate, actor: User) -> Asset:
    tag = payload.asset_tag.strip().upper()
    if db.scalar(select(Asset).where(Asset.asset_tag == tag)):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Asset tag already exists")

    if payload.serial_number and db.scalar(select(Asset).where(Asset.serial_number == payload.serial_number.strip())):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Serial number already registered")

    if not db.get(Category, payload.category_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

    asset = Asset(
        asset_tag=tag,
        serial_number=payload.serial_number.strip() if payload.serial_number else None,
        name=payload.name.strip(),
        brand_model=payload.brand_model.strip() if payload.brand_model else None,
        specs=payload.specs,
        mac_address=payload.mac_address.strip() if payload.mac_address else None,
        operating_system=payload.operating_system.strip() if payload.operating_system else None,
        processor=payload.processor.strip() if payload.processor else None,
        ram=payload.ram.strip() if payload.ram else None,
        storage=payload.storage.strip() if payload.storage else None,
        acquisition_date=payload.acquisition_date,
        acquisition_cost=payload.acquisition_cost,
        assigned_department=payload.assigned_department.strip() if payload.assigned_department else None,
        comments=payload.comments.strip() if payload.comments else None,
        category_id=payload.category_id,
        lab_room_id=payload.lab_room_id,
        station_id=payload.station_id,
        status=payload.status,
        condition=payload.condition,
    )
    db.add(asset)
    db.flush()

    db.add(
        AuditLog(
            actor_id=actor.id,
            action="ASSET_CREATED",
            entity_type="asset",
            entity_id=asset.id,
            details=f"Registered asset {asset.asset_tag} ({asset.name})",
        )
    )
    db.commit()
    db.refresh(asset)
    return asset


def update_asset(db: Session, asset_id: int, payload: AssetUpdate, actor: User) -> Asset:
    asset = db.get(Asset, asset_id)
    if not asset or asset.deactivated_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")

    _apply_asset_update(db, asset, payload, actor)
    db.commit()
    db.refresh(asset)
    return asset


def _apply_asset_update(db: Session, asset: Asset, payload: AssetUpdate, actor: User) -> None:
    update_data = payload.model_dump(exclude_unset=True)
    if "asset_tag" in update_data:
        if update_data["asset_tag"] is None or not update_data["asset_tag"].strip():
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Asset tag cannot be empty")
        asset_tag = update_data["asset_tag"].strip().upper()
        duplicate = db.scalar(
            select(Asset).where(
                func.upper(Asset.asset_tag) == asset_tag,
                Asset.id != asset.id,
            )
        )
        if duplicate:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Asset tag already exists")
        update_data["asset_tag"] = asset_tag

    if "name" in update_data:
        if update_data["name"] is None or not update_data["name"].strip():
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Asset name cannot be empty")
        update_data["name"] = update_data["name"].strip()
    if "category_id" in update_data:
        if update_data["category_id"] is None:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Category is required")
        if not db.get(Category, update_data["category_id"]):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    for required_enum in ("status", "condition"):
        if required_enum in update_data and update_data[required_enum] is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Asset {required_enum} is required",
            )

    if update_data.get("serial_number"):
        update_data["serial_number"] = update_data["serial_number"].strip()
        duplicate = db.scalar(
            select(Asset).where(
                Asset.serial_number == update_data["serial_number"],
                Asset.id != asset.id,
            )
        )
        if duplicate:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Serial number already registered")
    elif "serial_number" in update_data:
        update_data["serial_number"] = None

    for field in (
        "brand_model",
        "mac_address",
        "operating_system",
        "processor",
        "ram",
        "storage",
        "assigned_department",
        "comments",
    ):
        if field in update_data and update_data[field] is not None:
            update_data[field] = update_data[field].strip() or None

    for field, value in update_data.items():
        if field == "brand_model" and value:
            value = value.strip()
        setattr(asset, field, value)

    db.add(
        AuditLog(
            actor_id=actor.id,
            action="ASSET_UPDATED",
            entity_type="asset",
            entity_id=asset.id,
            details=f"Updated asset {asset.asset_tag}",
        )
    )


def create_asset_edit_request(
    db: Session,
    asset_id: int,
    payload: AssetEditRequestCreate,
    actor: User,
) -> dict:
    asset = db.get(Asset, asset_id)
    if not asset or asset.deactivated_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")

    proposed_changes = payload.changes.model_dump(mode="json", exclude_unset=True)
    if not proposed_changes:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="At least one change is required")
    reason = payload.reason.strip()
    if not reason:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="A reason is required")

    edit_request = AssetEditRequest(
        asset_id=asset.id,
        requested_by_id=actor.id,
        proposed_changes=proposed_changes,
        reason=reason,
    )
    db.add(edit_request)
    db.flush()
    db.add(
        AuditLog(
            actor_id=actor.id,
            action="ASSET_EDIT_REQUESTED",
            entity_type="asset",
            entity_id=asset.id,
            details=f"Requested changes to asset {asset.asset_tag}",
        )
    )
    db.commit()
    db.refresh(edit_request)
    return _asset_edit_request_response(db, edit_request, asset)


def list_asset_edit_requests(
    db: Session,
    *,
    requester_id: int | None = None,
    status_filter: AssetEditRequestStatus | None = None,
) -> list[dict]:
    stmt = select(AssetEditRequest).order_by(AssetEditRequest.created_at.desc())
    if requester_id is not None:
        stmt = stmt.where(AssetEditRequest.requested_by_id == requester_id)
    if status_filter is not None:
        stmt = stmt.where(AssetEditRequest.status == status_filter)

    return [
        _asset_edit_request_response(db, request, db.get(Asset, request.asset_id))
        for request in db.scalars(stmt).all()
    ]


def approve_asset_edit_request(
    db: Session,
    request_id: int,
    actor: User,
    note: str | None = None,
) -> dict:
    edit_request = _get_pending_edit_request(db, request_id)
    asset = db.get(Asset, edit_request.asset_id)
    if not asset or asset.deactivated_at is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="The requested asset is no longer active")

    changes = AssetUpdate.model_validate(edit_request.proposed_changes)
    _apply_asset_update(db, asset, changes, actor)
    _finish_edit_request(edit_request, actor, AssetEditRequestStatus.APPROVED, note)
    db.add(
        AuditLog(
            actor_id=actor.id,
            action="ASSET_EDIT_REQUEST_APPROVED",
            entity_type="asset",
            entity_id=asset.id,
            details=f"Approved changes to asset {asset.asset_tag}",
        )
    )
    db.commit()
    db.refresh(edit_request)
    return _asset_edit_request_response(db, edit_request, asset)


def reject_asset_edit_request(
    db: Session,
    request_id: int,
    actor: User,
    note: str | None = None,
) -> dict:
    edit_request = _get_pending_edit_request(db, request_id)
    asset = db.get(Asset, edit_request.asset_id)
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")

    _finish_edit_request(edit_request, actor, AssetEditRequestStatus.REJECTED, note)
    db.add(
        AuditLog(
            actor_id=actor.id,
            action="ASSET_EDIT_REQUEST_REJECTED",
            entity_type="asset",
            entity_id=asset.id,
            details=f"Rejected changes to asset {asset.asset_tag}",
        )
    )
    db.commit()
    db.refresh(edit_request)
    return _asset_edit_request_response(db, edit_request, asset)


def _get_pending_edit_request(db: Session, request_id: int) -> AssetEditRequest:
    edit_request = db.scalar(
        select(AssetEditRequest)
        .where(AssetEditRequest.id == request_id)
        .with_for_update()
    )
    if not edit_request:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Edit request not found")
    if edit_request.status != AssetEditRequestStatus.PENDING:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Edit request has already been reviewed")
    return edit_request


def _finish_edit_request(
    edit_request: AssetEditRequest,
    actor: User,
    decision: AssetEditRequestStatus,
    note: str | None,
) -> None:
    edit_request.status = decision
    edit_request.reviewed_by_id = actor.id
    edit_request.reviewed_at = datetime.now(UTC)
    edit_request.review_note = note.strip() if note and note.strip() else None


def _asset_edit_request_response(
    db: Session,
    edit_request: AssetEditRequest,
    asset: Asset,
) -> dict:
    requester = db.get(User, edit_request.requested_by_id)
    return {
        "id": edit_request.id,
        "asset_id": edit_request.asset_id,
        "asset_tag": asset.asset_tag,
        "asset_name": asset.name,
        "requested_by_id": edit_request.requested_by_id,
        "requested_by_name": requester.full_name if requester else "Unknown user",
        "proposed_changes": edit_request.proposed_changes,
        "reason": edit_request.reason,
        "status": edit_request.status,
        "review_note": edit_request.review_note,
        "created_at": edit_request.created_at,
        "reviewed_at": edit_request.reviewed_at,
    }
    db.commit()
    db.refresh(asset)
    return asset


async def upload_asset_image(db: Session, asset_id: int, file: UploadFile, actor: User) -> Asset:
    asset = db.get(Asset, asset_id)
    if not asset or asset.deactivated_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")

    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Only JPEG, PNG, or WEBP images are allowed",
        )

    content = await file.read()
    if len(content) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Image size must not exceed 5 MB",
        )

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    # Remove previous image file if one existed
    if asset.image_url:
        old_path = Path(asset.image_url.lstrip("/"))
        if old_path.exists():
            old_path.unlink()

    ext = ALLOWED_IMAGE_TYPES[file.content_type]
    filename = f"{asset.asset_tag.lower()}_{uuid.uuid4().hex[:8]}{ext}"
    file_path = UPLOAD_DIR / filename
    file_path.write_bytes(content)

    asset.image_url = f"/uploads/assets/{filename}"
    db.add(
        AuditLog(
            actor_id=actor.id,
            action="ASSET_IMAGE_UPLOADED",
            entity_type="asset",
            entity_id=asset.id,
            details=f"Uploaded photo for {asset.asset_tag}",
        )
    )
    db.commit()
    db.refresh(asset)
    return asset


def archive_asset(db: Session, asset_id: int, actor: User) -> Asset:
    asset = db.get(Asset, asset_id)
    if not asset or asset.deactivated_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")

    if asset.status == AssetStatus.BORROWED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cannot archive a borrowed asset")

    asset.status = AssetStatus.RETIRED
    asset.deactivated_at = datetime.now(UTC)

    db.add(
        AuditLog(
            actor_id=actor.id,
            action="ASSET_ARCHIVED",
            entity_type="asset",
            entity_id=asset.id,
            details=f"Archived asset {asset.asset_tag}",
        )
    )
    db.commit()
    db.refresh(asset)
    return asset