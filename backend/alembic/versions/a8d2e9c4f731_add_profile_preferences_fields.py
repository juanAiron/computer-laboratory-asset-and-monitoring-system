"""Add profile preference fields

Revision ID: a8d2e9c4f731
Revises: 9d1f4a2b8c33
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a8d2e9c4f731"
down_revision: Union[str, None] = "9d1f4a2b8c33"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("department", sa.String(length=100), nullable=True))
    op.add_column("users", sa.Column("office", sa.String(length=100), nullable=True))
    op.add_column("users", sa.Column("profile_visibility", sa.String(length=20), nullable=False, server_default="members"))
    op.add_column("users", sa.Column("activity_visibility", sa.String(length=20), nullable=False, server_default="members"))


def downgrade() -> None:
    op.drop_column("users", "activity_visibility")
    op.drop_column("users", "profile_visibility")
    op.drop_column("users", "office")
    op.drop_column("users", "department")
