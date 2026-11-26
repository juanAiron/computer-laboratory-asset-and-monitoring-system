"""Group schedule rows created together.

Revision ID: e5f6a7b8c901
Revises: d4e5f6a7b890
"""
from collections import defaultdict
from collections.abc import Sequence
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

revision: str = "e5f6a7b8c901"
down_revision: str | None = "d4e5f6a7b890"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "class_schedules",
        sa.Column("schedule_group_id", sa.String(length=36), nullable=True),
    )

    schedules = sa.table(
        "class_schedules",
        sa.column("id", sa.Integer()),
        sa.column("room_code", sa.String()),
        sa.column("day_of_week", sa.Integer()),
        sa.column("start_time", sa.Time()),
        sa.column("end_time", sa.Time()),
        sa.column("class_code", sa.String()),
        sa.column("course_number", sa.String()),
        sa.column("course_name", sa.String()),
        sa.column("instructor_id", sa.Integer()),
        sa.column("instructor_name", sa.String()),
        sa.column("created_at", sa.DateTime(timezone=True)),
        sa.column("schedule_group_id", sa.String(length=36)),
    )
    bind = op.get_bind()
    rows = bind.execute(
        sa.select(
            schedules.c.id,
            schedules.c.room_code,
            schedules.c.day_of_week,
            schedules.c.start_time,
            schedules.c.end_time,
            schedules.c.class_code,
            schedules.c.course_number,
            schedules.c.course_name,
            schedules.c.instructor_id,
            schedules.c.instructor_name,
            schedules.c.created_at,
        )
    ).mappings()

    matching_schedules = defaultdict(list)
    for row in rows:
        fingerprint = (
            row["room_code"],
            row["start_time"],
            row["end_time"],
            row["class_code"],
            row["course_number"],
            row["course_name"],
            row["instructor_id"],
            row["instructor_name"],
        )
        matching_schedules[fingerprint].append(row)

    def assign_group(group_rows) -> None:
        group_id = str(uuid4())
        for row in group_rows:
            bind.execute(
                sa.update(schedules)
                .where(schedules.c.id == row["id"])
                .values(schedule_group_id=group_id)
            )

    def assign_created_groups(matching_rows) -> None:
        matching_rows.sort(key=lambda row: row["created_at"])
        cluster = []
        for row in matching_rows:
            if cluster and (row["created_at"] - cluster[0]["created_at"]).total_seconds() > 2:
                _assign_cluster(cluster)
                cluster = []
            cluster.append(row)
        if cluster:
            _assign_cluster(cluster)

    def _assign_cluster(cluster) -> None:
        distinct_days = {row["day_of_week"] for row in cluster}
        if len(cluster) > 1 and len(distinct_days) == len(cluster):
            assign_group(cluster)
        else:
            for row in cluster:
                assign_group([row])

    for matching_rows in matching_schedules.values():
        assign_created_groups(matching_rows)

    with op.batch_alter_table("class_schedules") as batch_op:
        batch_op.alter_column(
            "schedule_group_id",
            existing_type=sa.String(length=36),
            nullable=False,
        )
        batch_op.create_index(
            "ix_class_schedules_schedule_group_id",
            ["schedule_group_id"],
            unique=False,
        )


def downgrade() -> None:
    with op.batch_alter_table("class_schedules") as batch_op:
        batch_op.drop_index("ix_class_schedules_schedule_group_id")
        batch_op.drop_column("schedule_group_id")
