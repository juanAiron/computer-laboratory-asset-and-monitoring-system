from datetime import datetime, timezone
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.features.assets.models import Asset, AssetCondition, AssetStatus
from app.features.labs.models import LabStation
from app.features.repairs.models import RepairStatus, RepairTicket
from app.features.repairs.schemas import RepairCreate, RepairUpdate
from app.features.users.models import User


def list_repairs(db: Session, status_filter: RepairStatus | None = None) -> list[RepairTicket]:
    stmt = select(RepairTicket).order_by(RepairTicket.created_at.desc())
    if status_filter:
        stmt = stmt.where(RepairTicket.status == status_filter)
    return list(db.scalars(stmt).all())


def create_repair_ticket(db: Session, payload: RepairCreate, reporter: User) -> RepairTicket:
    if not payload.asset_id and not payload.station_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Provide either an asset_id or station_id",
        )

    if payload.asset_id:
        asset = db.get(Asset, payload.asset_id)
        if not asset:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")
        asset.status = AssetStatus.UNDER_REPAIR
        asset.condition = AssetCondition.DEFECTIVE

    if payload.station_id:
        station = db.get(LabStation, payload.station_id)
        if not station:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lab station not found")
        station.is_operational = False

    ticket = RepairTicket(
        asset_id=payload.asset_id,
        station_id=payload.station_id,
        reported_by_id=reporter.id,
        issue_description=payload.issue_description.strip(),
        status=RepairStatus.OPEN,
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return ticket


def update_repair_ticket(db: Session, ticket_id: int, payload: RepairUpdate, custodian: User) -> RepairTicket:
    ticket = db.get(RepairTicket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repair ticket not found")

    ticket.status = payload.status
    ticket.assigned_to_id = custodian.id
    if payload.resolution_notes:
        ticket.resolution_notes = payload.resolution_notes.strip()

    if payload.status == RepairStatus.RESOLVED:
        ticket.resolved_at = datetime.now(timezone.utc)
        if ticket.asset_id:
            asset = db.get(Asset, ticket.asset_id)
            if asset:
                asset.status = AssetStatus.AVAILABLE
                asset.condition = AssetCondition.GOOD
        if ticket.station_id:
            station = db.get(LabStation, ticket.station_id)
            if station:
                station.is_operational = True

    elif payload.status == RepairStatus.UNREPAIRABLE and ticket.asset_id:
        asset = db.get(Asset, ticket.asset_id)
        if asset:
            asset.status = AssetStatus.RETIRED
            asset.deactivated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(ticket)
    return ticket