"""Add class code and course number to schedules

Revision ID: c3e4f5a6b789
Revises: b1c2d3e4f567
"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "c3e4f5a6b789"
down_revision: str | None = "b1c2d3e4f567"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "class_schedules",
        sa.Column("class_code", sa.String(length=50), nullable=True),
    )
    op.add_column(
        "class_schedules",
        sa.Column("course_number", sa.String(length=50), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("class_schedules", "course_number")
    op.drop_column("class_schedules", "class_code")
