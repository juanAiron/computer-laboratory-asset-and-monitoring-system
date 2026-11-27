from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.features.assets.models import Asset
from app.features.counts.models import (
    CountItem,
    CountItemStatus,
    CountStatus,
    InventoryCount,
)
from app.features.counts.schemas import CountItemOut, CountSessionResponse
from app.features.labs.models import LabRoom
from app.features.users.models import User


def list_inventory_counts(db: Session) -> list[CountSessionResponse]:
    counts = db.scalars(
        select(InventoryCount).order_by(InventoryCount.started_at.desc())
    ).all()
    return [_build_count_response(db, count) for count in counts]


def _build_count_response(db: Session, count: InventoryCount) -> CountSessionResponse:
    rows = db.execute(
        select(CountItem, Asset)
        .join(Asset, CountItem.asset_id == Asset.id)
        .where(CountItem.count_id == count.id)
        .order_by(Asset.asset_tag.asc())
    ).all()
    items = [
        CountItemOut(
            id=ci.id,
            asset_id=a.id,
            asset_tag=a.asset_tag,
            asset_name=a.name,
            status=ci.status,
            scanned_at=ci.scanned_at,
        )
        for ci, a in rows
    ]
    return CountSessionResponse(
        id=count.id,
        lab_room_id=count.lab_room_id,
        status=count.status,
        started_at=count.started_at,
        closed_at=count.closed_at,
        items=items,
    )


def start_inventory_count(db: Session, lab_room_id: int, notes: str | None, custodian: User) -> CountSessionResponse:
    if not db.get(LabRoom, lab_room_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lab room not found")

    count = InventoryCount(lab_room_id=lab_room_id, conducted_by_id=custodian.id, notes=notes)
    db.add(count)
    db.flush()

    expected_assets = db.scalars(
        select(Asset).where(Asset.lab_room_id == lab_room_id, Asset.deactivated_at.is_(None))
    ).all()
    for asset in expected_assets:
        db.add(CountItem(count_id=count.id, asset_id=asset.id, status=CountItemStatus.PENDING))

    db.commit()
    db.refresh(count)
    return _build_count_response(db, count)


def scan_count_item(db: Session, count_id: int, asset_tag: str) -> CountSessionResponse:
    count = db.get(InventoryCount, count_id)
    if not count or count.status != CountStatus.IN_PROGRESS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Active inventory count not found")

    asset = db.scalar(select(Asset).where(Asset.asset_tag == asset_tag.strip().upper()))
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Asset '{asset_tag}' not found")

    now = datetime.now(timezone.utc)
    asset.last_audited_at = now
    existing_item = db.scalar(
        select(CountItem).where(CountItem.count_id == count.id, CountItem.asset_id == asset.id)
    )
    if existing_item:
        existing_item.status = CountItemStatus.FOUND
        existing_item.scanned_at = now
    else:
        db.add(CountItem(count_id=count.id, asset_id=asset.id, status=CountItemStatus.MISPLACED, scanned_at=now))

    db.commit()
    return _build_count_response(db, count)


def close_inventory_count(db: Session, count_id: int) -> CountSessionResponse:
    count = db.get(InventoryCount, count_id)
    if not count or count.status != CountStatus.IN_PROGRESS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Active inventory count not found")

    pending_items = db.scalars(
        select(CountItem).where(CountItem.count_id == count.id, CountItem.status == CountItemStatus.PENDING)
    ).all()
    for item in pending_items:
        item.status = CountItemStatus.MISSING

    count.status = CountStatus.COMPLETED
    count.closed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(count)
    return _build_count_response(db, count)