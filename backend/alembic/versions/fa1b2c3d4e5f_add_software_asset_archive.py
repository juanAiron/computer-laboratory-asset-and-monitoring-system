"""Add soft-archive support for software inventory."""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "fa1b2c3d4e5f"
down_revision: str | None = "f9c0d1234567"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "software_assets",
        sa.Column("deactivated_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("software_assets", "deactivated_at")
