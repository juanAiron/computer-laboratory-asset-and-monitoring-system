from datetime import datetime
from pydantic import BaseModel


class BorrowCreate(BaseModel):
    asset_id: int
    borrower_id: int
    due_at: datetime
    notes: str | None = None


class BorrowReturn(BaseModel):
    notes: str | None = None


class BorrowResponse(BaseModel):
    id: int
    asset_id: int
    asset_tag: str
    asset_name: str
    borrower_id: int
    borrower_name: str
    issued_by_id: int
    borrowed_at: datetime
    due_at: datetime
    returned_at: datetime | None
    is_overdue: bool
    notes: str | None