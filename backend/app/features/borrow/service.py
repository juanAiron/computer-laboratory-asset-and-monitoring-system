from datetime import datetime, timezone
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.features.assets.models import Asset, AssetStatus
from app.features.borrow.models import Borrow
from app.features.borrow.schemas import BorrowCreate, BorrowResponse
from app.features.users.models import User
from app.shared.audit import AuditLog


def _serialize_borrow(borrow: Borrow, asset: Asset, borrower: User) -> BorrowResponse:
    now = datetime.now(timezone.utc)
    is_overdue = borrow.returned_at is None and borrow.due_at < now
    return BorrowResponse(
        id=borrow.id,
        asset_id=borrow.asset_id,
        asset_tag=asset.asset_tag,
        asset_name=asset.name,
        borrower_id=borrow.borrower_id,
        borrower_name=borrower.full_name,
        issued_by_id=borrow.issued_by_id,
        borrowed_at=borrow.borrowed_at,
        due_at=borrow.due_at,
        returned_at=borrow.returned_at,
        is_overdue=is_overdue,
        notes=borrow.notes,
    )


def list_borrows(db: Session, active_only: bool = False, borrower_id: int | None = None) -> list[BorrowResponse]:
    stmt = (
        select(Borrow, Asset, User)
        .join(Asset, Borrow.asset_id == Asset.id)
        .join(User, Borrow.borrower_id == User.id)
        .order_by(Borrow.borrowed_at.desc())
    )
    if active_only:
        stmt = stmt.where(Borrow.returned_at.is_(None))
    if borrower_id:
        stmt = stmt.where(Borrow.borrower_id == borrower_id)

    rows = db.execute(stmt).all()
    return [_serialize_borrow(b, a, u) for b, a, u in rows]


def checkout_asset(db: Session, payload: BorrowCreate, custodian: User) -> BorrowResponse:
    asset = db.get(Asset, payload.asset_id)
    if not asset or asset.deactivated_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")

    if asset.status != AssetStatus.AVAILABLE:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Asset '{asset.asset_tag}' is currently {asset.status.value} and cannot be borrowed",
        )

    borrower = db.get(User, payload.borrower_id)
    if not borrower or not borrower.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Active borrower account not found")

    borrow = Borrow(
        asset_id=asset.id,
        borrower_id=borrower.id,
        issued_by_id=custodian.id,
        due_at=payload.due_at,
        notes=payload.notes,
    )
    asset.status = AssetStatus.BORROWED
    db.add(borrow)

    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Asset already has an active borrow record")

    db.add(
        AuditLog(
            actor_id=custodian.id,
            action="ASSET_CHECKED_OUT",
            entity_type="borrow",
            entity_id=borrow.id,
            details=f"Issued {asset.asset_tag} to {borrower.email}",
        )
    )
    db.commit()
    db.refresh(borrow)
    return _serialize_borrow(borrow, asset, borrower)


def return_asset(db: Session, borrow_id: int, notes: str | None, custodian: User) -> BorrowResponse:
    borrow = db.get(Borrow, borrow_id)
    if not borrow or borrow.returned_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Open borrow record not found")

    asset = db.get(Asset, borrow.asset_id)
    borrower = db.get(User, borrow.borrower_id)

    borrow.returned_at = datetime.now(timezone.utc)
    if notes:
        borrow.notes = f"{borrow.notes or ''} | Return note: {notes}".strip(" |")
    if asset:
        asset.status = AssetStatus.AVAILABLE

    db.add(
        AuditLog(
            actor_id=custodian.id,
            action="ASSET_RETURNED",
            entity_type="borrow",
            entity_id=borrow.id,
            details=f"Returned {asset.asset_tag if asset else borrow.asset_id}",
        )
    )
    db.commit()
    db.refresh(borrow)
    return _serialize_borrow(borrow, asset, borrower)