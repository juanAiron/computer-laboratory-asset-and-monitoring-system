"""Add persistent classroom schedules

Revision ID: b1c2d3e4f567
Revises: a8d2e9c4f731
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b1c2d3e4f567"
down_revision: Union[str, None] = "a8d2e9c4f731"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "class_schedules",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("room_code", sa.String(length=10), nullable=False),
        sa.Column("day_of_week", sa.Integer(), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("end_time", sa.Time(), nullable=False),
        sa.Column("course_name", sa.String(length=100), nullable=False),
        sa.Column("instructor_name", sa.String(length=150), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_class_schedules_id"), "class_schedules", ["id"], unique=False)
    op.create_index(op.f("ix_class_schedules_room_code"), "class_schedules", ["room_code"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_class_schedules_room_code"), table_name="class_schedules")
    op.drop_index(op.f("ix_class_schedules_id"), table_name="class_schedules")
    op.drop_table("class_schedules")
