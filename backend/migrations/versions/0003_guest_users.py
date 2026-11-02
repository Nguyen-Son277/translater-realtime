"""Mark anonymous invite participants without changing existing accounts."""
import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade():
    # ALTER ADD preserves users and every referencing session/membership/message.
    op.add_column("users", sa.Column("is_guest", sa.Boolean(), nullable=False,
                                     server_default=sa.false()))


def downgrade():
    op.drop_column("users", "is_guest")
