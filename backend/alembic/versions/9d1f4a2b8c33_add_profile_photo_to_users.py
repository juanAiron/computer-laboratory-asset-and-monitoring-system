"""Add profile photo to users

Revision ID: 9d1f4a2b8c33
Revises: 6b1f4f2d8c31
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "9d1f4a2b8c33"
down_revision: Union[str, None] = "6b1f4f2d8c31"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("profile_photo_url", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "profile_photo_url")
