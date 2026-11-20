from datetime import datetime, timezone
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.features.assets.models import Asset, AssetStatus
from app.features.borrow.models import Borrow
from app.features.consumables.models import Consumable
from app.features.dashboard.schemas import DashboardStatsResponse
from app.features.repairs.models import RepairStatus, RepairTicket
from app.features.sessions.models import StationLog


def get_dashboard_stats(db: Session) -> DashboardStatsResponse:
    now = datetime.now(timezone.utc)
    active_assets = select(func.count(Asset.id)).where(Asset.deactivated_at.is_(None))

    return DashboardStatsResponse(
        total_assets=db.scalar(active_assets) or 0,
        available_assets=db.scalar(active_assets.where(Asset.status == AssetStatus.AVAILABLE)) or 0,
        borrowed_assets=db.scalar(active_assets.where(Asset.status == AssetStatus.BORROWED)) or 0,
        under_repair_assets=db.scalar(active_assets.where(Asset.status == AssetStatus.UNDER_REPAIR)) or 0,
        overdue_borrows=db.scalar(
            select(func.count(Borrow.id)).where(Borrow.returned_at.is_(None), Borrow.due_at < now)
        ) or 0,
        low_stock_consumables=db.scalar(
            select(func.count(Consumable.id)).where(
                Consumable.deactivated_at.is_(None),
                Consumable.quantity <= Consumable.reorder_level,
            )
        ) or 0,
        active_students_in_labs=db.scalar(
            select(func.count(StationLog.id)).where(StationLog.time_out.is_(None))
        ) or 0,
        open_repair_tickets=db.scalar(
            select(func.count(RepairTicket.id)).where(
                RepairTicket.status.in_([RepairStatus.OPEN, RepairStatus.IN_PROGRESS])
            )
        ) or 0,
    )