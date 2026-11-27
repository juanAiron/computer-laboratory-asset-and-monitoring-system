"""Add asset edit approval requests."""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "f7a8b9c0d123"
down_revision: str | None = "e5f6a7b8c901"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "asset_edit_requests",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("asset_id", sa.Integer(), nullable=False),
        sa.Column("requested_by_id", sa.Integer(), nullable=False),
        sa.Column("reviewed_by_id", sa.Integer(), nullable=True),
        sa.Column("proposed_changes", sa.JSON(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column(
            "status",
            sa.Enum("PENDING", "APPROVED", "REJECTED", name="asseteditrequeststatus"),
            nullable=False,
        ),
        sa.Column("review_note", sa.Text(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["asset_id"], ["assets.id"]),
        sa.ForeignKeyConstraint(["requested_by_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["reviewed_by_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_asset_edit_requests_id",
        "asset_edit_requests",
        ["id"],
        unique=False,
    )
    op.create_index(
        "ix_asset_edit_requests_asset_id",
        "asset_edit_requests",
        ["asset_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_asset_edit_requests_asset_id", table_name="asset_edit_requests")
    op.drop_index("ix_asset_edit_requests_id", table_name="asset_edit_requests")
    op.drop_table("asset_edit_requests")
