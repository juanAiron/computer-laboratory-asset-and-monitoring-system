"""Add detailed hardware inventory register fields."""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "f9c0d1234567"
down_revision: str | None = "f8b9c0d12345"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        for value in ("WORKING", "FOR_REPLACEMENT", "MAINTENANCE", "FOR_CONDEMN", "FOR_WARRANTY"):
            op.execute(sa.text(f"ALTER TYPE assetcondition ADD VALUE IF NOT EXISTS '{value}'"))

    op.add_column("assets", sa.Column("mac_address", sa.String(length=50), nullable=True))
    op.add_column("assets", sa.Column("operating_system", sa.String(length=150), nullable=True))
    op.add_column("assets", sa.Column("processor", sa.String(length=150), nullable=True))
    op.add_column("assets", sa.Column("ram", sa.String(length=50), nullable=True))
    op.add_column("assets", sa.Column("storage", sa.String(length=100), nullable=True))
    op.add_column("assets", sa.Column("acquisition_date", sa.Date(), nullable=True))
    op.add_column("assets", sa.Column("acquisition_cost", sa.Numeric(precision=12, scale=2), nullable=True))
    op.add_column("assets", sa.Column("assigned_department", sa.String(length=150), nullable=True))
    op.add_column("assets", sa.Column("last_audited_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("assets", sa.Column("comments", sa.Text(), nullable=True))

    op.execute(
        sa.text(
            """
            UPDATE assets
            SET last_audited_at = (
                SELECT MAX(count_items.scanned_at)
                FROM count_items
                WHERE count_items.asset_id = assets.id
            )
            WHERE EXISTS (
                SELECT 1
                FROM count_items
                WHERE count_items.asset_id = assets.id
                  AND count_items.scanned_at IS NOT NULL
            )
            """
        )
    )


def downgrade() -> None:
    op.drop_column("assets", "comments")
    op.drop_column("assets", "last_audited_at")
    op.drop_column("assets", "assigned_department")
    op.drop_column("assets", "acquisition_cost")
    op.drop_column("assets", "acquisition_date")
    op.drop_column("assets", "storage")
    op.drop_column("assets", "ram")
    op.drop_column("assets", "processor")
    op.drop_column("assets", "operating_system")
    op.drop_column("assets", "mac_address")

    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("ALTER TYPE assetcondition RENAME TO assetcondition_new")
        op.execute("CREATE TYPE assetcondition AS ENUM ('GOOD', 'FAIR', 'DEFECTIVE')")
        op.execute(
            """
            ALTER TABLE assets
            ALTER COLUMN condition TYPE assetcondition
            USING (
                CASE condition::text
                    WHEN 'WORKING' THEN 'GOOD'
                    WHEN 'FOR_REPLACEMENT' THEN 'DEFECTIVE'
                    WHEN 'MAINTENANCE' THEN 'FAIR'
                    WHEN 'FOR_CONDEMN' THEN 'DEFECTIVE'
                    WHEN 'FOR_WARRANTY' THEN 'FAIR'
                    ELSE condition::text
                END
            )::assetcondition
            """
        )
        op.execute("DROP TYPE assetcondition_new")
