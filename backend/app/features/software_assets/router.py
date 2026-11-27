from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.permissions import require_role
from app.db.session import get_db
from app.features.software_assets import service
from app.features.software_assets.models import SoftwareEditRequestStatus
from app.features.software_assets.schemas import (
    SoftwareAssetCreate,
    SoftwareAssetResponse,
    SoftwareAssetUpdate,
    SoftwareEditRequestCreate,
    SoftwareEditRequestResponse,
    SoftwareEditRequestReview,
)
from app.features.users.models import User, UserRole

router = APIRouter(prefix="/software-assets", tags=["Software Assets & Subscriptions"])
INVENTORY_VIEW_ROLES = (UserRole.TRIL_ADMIN, UserRole.DEPT_HEAD, UserRole.CUSTODIAN)
INVENTORY_EDIT_ROLES = (UserRole.SUPER_ADMIN, UserRole.CUSTODIAN)


@router.get("", response_model=list[SoftwareAssetResponse])
def list_software_assets(
    _: User = Depends(require_role(*INVENTORY_VIEW_ROLES)),
    db: Session = Depends(get_db),
):
    return service.list_software_assets(db)


@router.post("", response_model=SoftwareAssetResponse, status_code=201)
def create_software_asset(
    payload: SoftwareAssetCreate,
    current_user: User = Depends(require_role(*INVENTORY_EDIT_ROLES)),
    db: Session = Depends(get_db),
):
    return service.create_software_asset(db, payload, current_user)


@router.patch("/{software_asset_id}", response_model=SoftwareAssetResponse)
def update_software_asset(
    software_asset_id: int,
    payload: SoftwareAssetUpdate,
    current_user: User = Depends(require_role(*INVENTORY_EDIT_ROLES)),
    db: Session = Depends(get_db),
):
    return service.update_software_asset(db, software_asset_id, payload, current_user)


@router.post("/{software_asset_id}/archive", response_model=SoftwareAssetResponse)
def archive_software_asset(
    software_asset_id: int,
    current_user: User = Depends(require_role(*INVENTORY_EDIT_ROLES)),
    db: Session = Depends(get_db),
):
    return service.archive_software_asset(db, software_asset_id, current_user)


@router.get("/edit-requests", response_model=list[SoftwareEditRequestResponse])
def list_edit_requests(
    status_filter: SoftwareEditRequestStatus | None = None,
    _: User = Depends(require_role(UserRole.SUPER_ADMIN)),
    db: Session = Depends(get_db),
):
    return service.list_edit_requests(db, status_filter=status_filter)


@router.get("/edit-requests/mine", response_model=list[SoftwareEditRequestResponse])
def list_my_edit_requests(
    current_user: User = Depends(require_role(UserRole.CUSTODIAN)),
    db: Session = Depends(get_db),
):
    return service.list_edit_requests(db, requester_id=current_user.id)


@router.post("/{software_asset_id}/edit-requests", response_model=SoftwareEditRequestResponse, status_code=201)
def request_software_edit(
    software_asset_id: int,
    payload: SoftwareEditRequestCreate,
    current_user: User = Depends(require_role(UserRole.CUSTODIAN)),
    db: Session = Depends(get_db),
):
    return service.create_edit_request(db, software_asset_id, payload, current_user)


@router.post(
    "/edit-requests/{request_id}/approve",
    response_model=SoftwareEditRequestResponse,
)
def approve_edit_request(
    request_id: int,
    payload: SoftwareEditRequestReview,
    current_user: User = Depends(require_role(UserRole.SUPER_ADMIN)),
    db: Session = Depends(get_db),
):
    return service.approve_edit_request(db, request_id, current_user, payload.note)


@router.post(
    "/edit-requests/{request_id}/reject",
    response_model=SoftwareEditRequestResponse,
)
def reject_edit_request(
    request_id: int,
    payload: SoftwareEditRequestReview,
    current_user: User = Depends(require_role(UserRole.SUPER_ADMIN)),
    db: Session = Depends(get_db),
):
    return service.reject_edit_request(db, request_id, current_user, payload.note)
