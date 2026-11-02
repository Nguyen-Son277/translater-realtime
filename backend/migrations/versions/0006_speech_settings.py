"""Persist global speech segmentation settings.

Revision ID: 0006
Revises: 0005
"""
import sqlalchemy as sa
from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade():
    # The application seeds this singleton once from validated environment values.
    op.create_table(
        "speech_settings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("silence_ms", sa.Integer(), nullable=False),
        sa.Column("max_segment_ms", sa.Integer(), nullable=False),
        sa.Column("preview_ms", sa.Integer(), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade():
    op.drop_table("speech_settings")
