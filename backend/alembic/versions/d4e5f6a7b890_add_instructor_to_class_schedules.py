"""Associate class schedules with instructor accounts.

Revision ID: d4e5f6a7b890
Revises: c3e4f5a6b789
"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "d4e5f6a7b890"
down_revision: str | None = "c3e4f5a6b789"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "class_schedules",
        sa.Column("instructor_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_class_schedules_instructor_id_users",
        "class_schedules",
        "users",
        ["instructor_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_class_schedules_instructor_id",
        "class_schedules",
        ["instructor_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_class_schedules_instructor_id", table_name="class_schedules")
    op.drop_constraint(
        "fk_class_schedules_instructor_id_users",
        "class_schedules",
        type_="foreignkey",
    )
    op.drop_column("class_schedules", "instructor_id")
