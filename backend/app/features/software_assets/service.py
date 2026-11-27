from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.features.software_assets.models import (
    SoftwareAsset,
    SoftwareEditRequest,
    SoftwareEditRequestStatus,
)
from app.features.software_assets.schemas import (
    SoftwareAssetCreate,
    SoftwareAssetUpdate,
    SoftwareEditRequestCreate,
)
from app.features.users.models import User
from app.shared.audit import AuditLog


def list_software_assets(db: Session) -> list[SoftwareAsset]:
    return list(
        db.scalars(
            select(SoftwareAsset)
            .where(SoftwareAsset.deactivated_at.is_(None))
            .order_by(SoftwareAsset.product_name.asc())
        ).all()
    )


def create_software_asset(
    db: Session,
    payload: SoftwareAssetCreate,
    actor: User,
) -> SoftwareAsset:
    data = payload.model_dump()
    data["product_name"] = data["product_name"].strip()
    data["vendor"] = data["vendor"].strip()
    data["license_type"] = data["license_type"].strip()
    for field in ("product_name", "vendor", "license_type"):
        if not data[field]:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"{field.replace('_', ' ').capitalize()} cannot be empty",
            )
    software_asset = SoftwareAsset(**data)
    db.add(software_asset)
    db.flush()
    db.add(
        AuditLog(
            actor_id=actor.id,
            action="SOFTWARE_ASSET_CREATED",
            entity_type="software_asset",
            entity_id=software_asset.id,
            details=f"Registered software {software_asset.product_name}",
        )
    )
    db.commit()
    db.refresh(software_asset)
    return software_asset


def update_software_asset(
    db: Session,
    software_asset_id: int,
    payload: SoftwareAssetUpdate,
    actor: User,
) -> SoftwareAsset:
    software_asset = _get_software_asset(db, software_asset_id)
    _apply_changes(software_asset, payload)
    db.add(
        AuditLog(
            actor_id=actor.id,
            action="SOFTWARE_ASSET_UPDATED",
            entity_type="software_asset",
            entity_id=software_asset.id,
            details=f"Updated software {software_asset.product_name}",
        )
    )
    db.commit()
    db.refresh(software_asset)
    return software_asset


def archive_software_asset(
    db: Session,
    software_asset_id: int,
    actor: User,
) -> SoftwareAsset:
    software_asset = _get_software_asset(db, software_asset_id)
    software_asset.deactivated_at = datetime.now(UTC)
    db.add(
        AuditLog(
            actor_id=actor.id,
            action="SOFTWARE_ASSET_ARCHIVED",
            entity_type="software_asset",
            entity_id=software_asset.id,
            details=f"Archived software {software_asset.product_name}",
        )
    )
    db.commit()
    db.refresh(software_asset)
    return software_asset


def create_edit_request(
    db: Session,
    software_asset_id: int,
    payload: SoftwareEditRequestCreate,
    actor: User,
) -> dict:
    software_asset = _get_software_asset(db, software_asset_id)
    changes = payload.changes.model_dump(exclude_unset=True, mode="json")
    if not changes:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="At least one change is required",
        )
    reason = payload.reason.strip()
    if not reason:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="A reason is required",
        )

    edit_request = SoftwareEditRequest(
        software_asset_id=software_asset.id,
        requested_by_id=actor.id,
        proposed_changes=changes,
        reason=reason,
    )
    db.add(edit_request)
    db.flush()
    db.add(
        AuditLog(
            actor_id=actor.id,
            action="SOFTWARE_EDIT_REQUESTED",
            entity_type="software_asset",
            entity_id=software_asset.id,
            details=f"Requested changes to software {software_asset.product_name}",
        )
    )
    db.commit()
    db.refresh(edit_request)
    return _request_response(db, edit_request, software_asset)


def list_edit_requests(
    db: Session,
    *,
    requester_id: int | None = None,
    status_filter: SoftwareEditRequestStatus | None = None,
) -> list[dict]:
    stmt = select(SoftwareEditRequest).order_by(SoftwareEditRequest.created_at.desc())
    if requester_id is not None:
        stmt = stmt.where(SoftwareEditRequest.requested_by_id == requester_id)
    if status_filter is not None:
        stmt = stmt.where(SoftwareEditRequest.status == status_filter)
    return [
        _request_response(db, edit_request, db.get(SoftwareAsset, edit_request.software_asset_id))
        for edit_request in db.scalars(stmt).all()
    ]


def approve_edit_request(
    db: Session,
    request_id: int,
    actor: User,
    note: str | None = None,
) -> dict:
    edit_request = _get_pending_request(db, request_id)
    software_asset = _get_software_asset(db, edit_request.software_asset_id)
    changes = SoftwareAssetUpdate.model_validate(edit_request.proposed_changes)
    _apply_changes(software_asset, changes)
    _finish_request(edit_request, actor, SoftwareEditRequestStatus.APPROVED, note)
    db.add(
        AuditLog(
            actor_id=actor.id,
            action="SOFTWARE_EDIT_REQUEST_APPROVED",
            entity_type="software_asset",
            entity_id=software_asset.id,
            details=f"Approved changes to software {software_asset.product_name}",
        )
    )
    db.commit()
    db.refresh(edit_request)
    return _request_response(db, edit_request, software_asset)


def reject_edit_request(
    db: Session,
    request_id: int,
    actor: User,
    note: str | None = None,
) -> dict:
    edit_request = _get_pending_request(db, request_id)
    software_asset = _get_software_asset(db, edit_request.software_asset_id)
    _finish_request(edit_request, actor, SoftwareEditRequestStatus.REJECTED, note)
    db.add(
        AuditLog(
            actor_id=actor.id,
            action="SOFTWARE_EDIT_REQUEST_REJECTED",
            entity_type="software_asset",
            entity_id=software_asset.id,
            details=f"Rejected changes to software {software_asset.product_name}",
        )
    )
    db.commit()
    db.refresh(edit_request)
    return _request_response(db, edit_request, software_asset)


def _apply_changes(
    software_asset: SoftwareAsset,
    payload: SoftwareAssetUpdate,
) -> None:
    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="At least one change is required",
        )
    for field in ("product_name", "vendor", "license_type"):
        if field in changes:
            if changes[field] is None or not changes[field].strip():
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"{field.replace('_', ' ').capitalize()} cannot be empty",
                )
            changes[field] = changes[field].strip()
    if "license_count" in changes and changes["license_count"] is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="License count is required",
        )
    if "currency_code" in changes and changes["currency_code"] is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Currency code is required",
        )
    if "status" in changes and changes["status"] is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Software status is required",
        )
    for field, value in changes.items():
        setattr(software_asset, field, value)


def _get_software_asset(db: Session, software_asset_id: int) -> SoftwareAsset:
    software_asset = db.scalar(
        select(SoftwareAsset).where(
            SoftwareAsset.id == software_asset_id,
            SoftwareAsset.deactivated_at.is_(None),
        )
    )
    if not software_asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Software asset not found")
    return software_asset


def _get_pending_request(db: Session, request_id: int) -> SoftwareEditRequest:
    edit_request = db.scalar(
        select(SoftwareEditRequest)
        .where(SoftwareEditRequest.id == request_id)
        .with_for_update()
    )
    if not edit_request:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Edit request not found")
    if edit_request.status != SoftwareEditRequestStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Edit request has already been reviewed",
        )
    return edit_request


def _finish_request(
    edit_request: SoftwareEditRequest,
    actor: User,
    decision: SoftwareEditRequestStatus,
    note: str | None,
) -> None:
    edit_request.status = decision
    edit_request.reviewed_by_id = actor.id
    edit_request.reviewed_at = datetime.now(UTC)
    edit_request.review_note = note.strip() if note and note.strip() else None


def _request_response(
    db: Session,
    edit_request: SoftwareEditRequest,
    software_asset: SoftwareAsset,
) -> dict:
    requester = db.get(User, edit_request.requested_by_id)
    return {
        "id": edit_request.id,
        "software_asset_id": edit_request.software_asset_id,
        "product_name": software_asset.product_name,
        "requested_by_id": edit_request.requested_by_id,
        "requested_by_name": requester.full_name if requester else "Unknown user",
        "proposed_changes": edit_request.proposed_changes,
        "reason": edit_request.reason,
        "status": edit_request.status,
        "review_note": edit_request.review_note,
        "created_at": edit_request.created_at,
        "reviewed_at": edit_request.reviewed_at,
    }
