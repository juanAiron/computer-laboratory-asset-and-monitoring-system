from datetime import datetime, timezone
from sqlalchemy import DateTime, ForeignKey, Index, Integer, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.audit import Base, TimestampMixin


class Borrow(Base, TimestampMixin):
    __tablename__ = "borrows"
    __table_args__ = (
        # Database-level rule: only ONE open borrow record per asset at a time
        Index(
            "uq_one_open_borrow_per_asset",
            "asset_id",
            unique=True,
            postgresql_where=text("returned_at IS NULL"),
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    asset_id: Mapped[int] = mapped_column(ForeignKey("assets.id"), nullable=False)
    borrower_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    issued_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    borrowed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    returned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)