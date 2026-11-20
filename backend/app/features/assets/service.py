import uuid
from datetime import datetime, timezone
from pathlib import Path
from fastapi import HTTPException, UploadFile, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.features.assets.models import Asset, AssetStatus, Category
from app.features.assets.schemas import AssetCreate, AssetUpdate, CategoryCreate
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

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
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
    asset.deactivated_at = datetime.now(timezone.utc)

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