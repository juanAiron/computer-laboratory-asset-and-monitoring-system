"""add super admin role

Revision ID: 6b1f4f2d8c31
Revises: 1531467c2e4e
Create Date: 2026-11-23
"""
from alembic import op


revision = "6b1f4f2d8c31"
down_revision = "1531467c2e4e"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'SUPER_ADMIN'")


def downgrade():
    pass
