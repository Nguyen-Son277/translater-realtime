"""Durable admin role and encrypted translation gateway settings.

Revision ID: 0005
Revises: 0004
"""
import sqlalchemy as sa
from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("users", sa.Column("is_admin", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.create_table(
        "translation_settings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("base_url", sa.String(2048), nullable=False, server_default=""),
        sa.Column("model", sa.String(200), nullable=False, server_default=""),
        sa.Column("api_key_encrypted", sa.Text(), nullable=True),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade():
    op.drop_table("translation_settings")
    op.drop_column("users", "is_admin")
