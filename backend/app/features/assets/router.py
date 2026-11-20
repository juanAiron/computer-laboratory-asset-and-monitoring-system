from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from app.core.permissions import get_current_user, require_role
from app.db.session import get_db
from app.features.assets import service
from app.features.assets.models import AssetStatus
from app.features.assets.schemas import (
    AssetCreate,
    AssetResponse,
    AssetUpdate,
    CategoryCreate,
    CategoryResponse,
)
from app.features.users.models import User, UserRole

router = APIRouter(prefix="/assets", tags=["Assets & Categories"])


@router.get("/categories", response_model=list[CategoryResponse])
def list_categories(
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.list_categories(db)


@router.post("/categories", response_model=CategoryResponse, status_code=201)
def create_category(
    payload: CategoryCreate,
    _: User = Depends(require_role(UserRole.TRIL_ADMIN, UserRole.CUSTODIAN)),
    db: Session = Depends(get_db),
):
    return service.create_category(db, payload)


@router.get("", response_model=list[AssetResponse])
def list_assets(
    search: str | None = None,
    status: AssetStatus | None = None,
    lab_room_id: int | None = None,
    category_id: int | None = None,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.list_assets(db, search=search, status_filter=status, lab_room_id=lab_room_id, category_id=category_id)


@router.get("/by-tag/{tag}", response_model=AssetResponse)
def get_asset_by_tag(
    tag: str,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.get_asset_by_tag(db, tag)


@router.post("", response_model=AssetResponse, status_code=201)
def create_asset(
    payload: AssetCreate,
    current_user: User = Depends(require_role(UserRole.TRIL_ADMIN, UserRole.CUSTODIAN)),
    db: Session = Depends(get_db),
):
    return service.create_asset(db, payload, current_user)


@router.patch("/{asset_id}", response_model=AssetResponse)
def update_asset(
    asset_id: int,
    payload: AssetUpdate,
    current_user: User = Depends(require_role(UserRole.TRIL_ADMIN, UserRole.CUSTODIAN)),
    db: Session = Depends(get_db),
):
    return service.update_asset(db, asset_id, payload, current_user)


@router.post("/{asset_id}/image", response_model=AssetResponse)
async def upload_asset_image(
    asset_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(require_role(UserRole.TRIL_ADMIN, UserRole.CUSTODIAN)),
    db: Session = Depends(get_db),
):
    return await service.upload_asset_image(db, asset_id, file, current_user)


@router.post("/{asset_id}/archive", response_model=AssetResponse)
def archive_asset(
    asset_id: int,
    current_user: User = Depends(require_role(UserRole.TRIL_ADMIN, UserRole.CUSTODIAN)),
    db: Session = Depends(get_db),
):
    return service.archive_asset(db, asset_id, current_user)