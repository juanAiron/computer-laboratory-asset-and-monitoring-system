from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.permissions import get_current_user
from app.db.session import get_db
from app.features.dashboard import service
from app.features.dashboard.schemas import DashboardStatsResponse
from app.features.users.models import User

router = APIRouter(prefix="/dashboard", tags=["Dashboard & Reports"])


@router.get("", response_model=DashboardStatsResponse)
def get_dashboard(
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.get_dashboard_stats(db)