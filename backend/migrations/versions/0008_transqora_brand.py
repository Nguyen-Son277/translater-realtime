"""Rename only the untouched default support message to Transqora.

Revision ID: 0008
Revises: 0007
"""
import sqlalchemy as sa
from alembic import op

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None

# Freeze both exact literals here: migrations must not import mutable app defaults.
OLD_DEFAULT = (
    "Ủng hộ admin phát triển ứng dụng mobile và đưa ứng dụng lên Google Play (CH Play) "
    "và App Store. Mọi sự ủng hộ đều giúp duy trì và cải thiện Song Ngữ. Xin cảm ơn bạn!"
)
NEW_DEFAULT = (
    "Ủng hộ admin phát triển ứng dụng mobile và đưa ứng dụng lên Google Play (CH Play) "
    "và App Store. Mọi sự ủng hộ đều giúp duy trì và cải thiện Transqora. Xin cảm ơn bạn!"
)


def replace_default(old, new):
    support = sa.table(
        "support_settings",
        sa.column("id", sa.Integer),
        sa.column("content", sa.Text),
        sa.column("revision", sa.Integer),
        sa.column("updated_at", sa.DateTime),
    )
    op.execute(support.update().where(
        support.c.id == 1, support.c.content == old,
    ).values(content=new, revision=support.c.revision + 1,
             updated_at=sa.func.current_timestamp()))


def upgrade():
    replace_default(OLD_DEFAULT, NEW_DEFAULT)


def downgrade():
    replace_default(NEW_DEFAULT, OLD_DEFAULT)
