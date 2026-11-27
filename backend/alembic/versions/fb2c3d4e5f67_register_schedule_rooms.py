"""Register existing schedule rooms in the shared lab room table."""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "fb2c3d4e5f67"
down_revision: str | None = "fa1b2c3d4e5f"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


SCHEDULE_ROOMS = (
    ("D522", "D522", "D522"),
    ("D524", "D524", "D524"),
    ("D526", "D526", "D526"),
    ("D528", "D528", "D528"),
    ("D422", "D422", "D422"),
    ("D424-KC", "Knowledge Center", "D424"),
    ("D426-OL", "Open Laboratory", "D426"),
    ("D427-CR", "Conference Room", "Conference Room"),
    ("D427-PL", "Photo Lab", "Photo Lab"),
    ("D428-SL", "Sound Lab", "Sound Lab"),
    ("D223", "D223", "D223"),
    ("D722", "D722", "D722"),
    ("D723", "D723", "D723"),
    ("D724", "D724", "D724"),
    ("D725", "D725", "D725"),
)


def upgrade() -> None:
    op.add_column(
        "lab_rooms",
        sa.Column("schedule_button_label", sa.String(length=100), nullable=True),
    )
    connection = op.get_bind()
    rooms = sa.table(
        "lab_rooms",
        sa.column("code", sa.String(length=30)),
        sa.column("name", sa.String(length=100)),
        sa.column("schedule_button_label", sa.String(length=100)),
        sa.column("capacity", sa.Integer()),
        sa.column("is_active", sa.Boolean()),
        sa.column("created_at", sa.DateTime(timezone=True)),
        sa.column("updated_at", sa.DateTime(timezone=True)),
    )
    existing_codes = set(connection.scalars(sa.select(rooms.c.code)).all())

    for code, name, schedule_button_label in SCHEDULE_ROOMS:
        if code not in existing_codes:
            connection.execute(
                rooms.insert().values(
                    code=code,
                    name=name,
                    schedule_button_label=schedule_button_label,
                    capacity=40,
                    is_active=True,
                    created_at=sa.func.now(),
                    updated_at=sa.func.now(),
                )
            )
        else:
            connection.execute(
                rooms.update()
                .where(
                    rooms.c.code == code,
                    rooms.c.schedule_button_label.is_(None),
                )
                .values(schedule_button_label=schedule_button_label)
            )


def downgrade() -> None:
    op.drop_column("lab_rooms", "schedule_button_label")
