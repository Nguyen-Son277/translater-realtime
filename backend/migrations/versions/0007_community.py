"""Persist moderated feedback and singleton support content/image.

Revision ID: 0007
Revises: 0006
"""
import sqlalchemy as sa
from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "feedback",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("author_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("author_name", sa.String(100), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("client_request_id", sa.String(100), nullable=False),
        sa.Column("is_hidden", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("author_id", "client_request_id"),
    )
    op.create_index("ix_feedback_visibility_created", "feedback", ["is_hidden", "created_at", "id"])
    op.create_index("ix_feedback_author_created", "feedback", ["author_id", "created_at"])
    op.create_table(
        "support_settings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("qr_image", sa.LargeBinary(), nullable=True),
        sa.Column("qr_media_type", sa.String(32), nullable=True),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )


def downgrade():
    op.drop_table("support_settings")
    op.drop_index("ix_feedback_author_created", table_name="feedback")
    op.drop_index("ix_feedback_visibility_created", table_name="feedback")
    op.drop_table("feedback")
