"""Add software assets and subscription edit approvals."""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "f8b9c0d12345"
down_revision: str | None = "f7a8b9c0d123"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "software_assets",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("product_name", sa.String(length=150), nullable=False),
        sa.Column("vendor", sa.String(length=150), nullable=False),
        sa.Column("version", sa.String(length=100), nullable=True),
        sa.Column("license_type", sa.String(length=50), nullable=False),
        sa.Column("license_count", sa.Integer(), nullable=False),
        sa.Column("currency_code", sa.String(length=3), server_default="PHP", nullable=False),
        sa.Column("assigned_to", sa.String(length=200), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("renewal_date", sa.Date(), nullable=True),
        sa.Column("expiry_date", sa.Date(), nullable=True),
        sa.Column("annual_cost", sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column(
            "status",
            sa.Enum("ACTIVE", "TRIAL", "RENEWAL_DUE", "EXPIRED", "CANCELLED", name="softwarestatus"),
            nullable=False,
        ),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_software_assets_id", "software_assets", ["id"], unique=False)

    op.create_table(
        "software_edit_requests",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("software_asset_id", sa.Integer(), nullable=False),
        sa.Column("requested_by_id", sa.Integer(), nullable=False),
        sa.Column("reviewed_by_id", sa.Integer(), nullable=True),
        sa.Column("proposed_changes", sa.JSON(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column(
            "status",
            sa.Enum("PENDING", "APPROVED", "REJECTED", name="softwareeditrequeststatus"),
            nullable=False,
        ),
        sa.Column("review_note", sa.Text(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["software_asset_id"], ["software_assets.id"]),
        sa.ForeignKeyConstraint(["requested_by_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["reviewed_by_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_software_edit_requests_id", "software_edit_requests", ["id"], unique=False)
    op.create_index(
        "ix_software_edit_requests_software_asset_id",
        "software_edit_requests",
        ["software_asset_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_software_edit_requests_software_asset_id",
        table_name="software_edit_requests",
    )
    op.drop_index("ix_software_edit_requests_id", table_name="software_edit_requests")
    op.drop_table("software_edit_requests")
    op.drop_index("ix_software_assets_id", table_name="software_assets")
    op.drop_table("software_assets")
