"""Add account names and optional emails for existing users."""
import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade():
    # Add columns directly so SQLite keeps all dependent rows and sessions intact.
    op.add_column("users", sa.Column("name", sa.String(100), nullable=False, server_default=""))
    op.add_column("users", sa.Column("email", sa.String(254), nullable=True))
    op.execute(sa.text("UPDATE users SET name = username"))
    op.create_index("ix_users_email", "users", ["email"], unique=True)


def downgrade():
    op.drop_index("ix_users_email", table_name="users")
    op.drop_column("users", "email")
    op.drop_column("users", "name")
