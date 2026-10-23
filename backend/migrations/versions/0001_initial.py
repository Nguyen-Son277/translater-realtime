"""Accounts, sessions, rooms and bilingual messages."""
import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("users",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("username", sa.String(32), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(256), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False))
    op.create_table("sessions",
        sa.Column("digest", sa.String(64), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False))
    op.create_index("ix_sessions_user_id", "sessions", ["user_id"])
    op.create_index("ix_sessions_expires_at", "sessions", ["expires_at"])
    op.create_table("rooms",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("owner_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(100), nullable=False),
        sa.Column("mode", sa.String(10), nullable=False),
        sa.Column("language_a", sa.String(5), nullable=False),
        sa.Column("language_b", sa.String(5), nullable=False),
        sa.Column("invite_digest", sa.String(64), unique=True),
        sa.Column("invite_expires_at", sa.DateTime()),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False))
    op.create_index("ix_rooms_updated_at", "rooms", ["updated_at"])
    op.create_table("memberships",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("room_id", sa.String(36), sa.ForeignKey("rooms.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("side", sa.String(1), nullable=False),
        sa.UniqueConstraint("room_id", "side"), sa.UniqueConstraint("room_id", "user_id"))
    op.create_index("ix_memberships_room_id", "memberships", ["room_id"])
    op.create_index("ix_memberships_user_id", "memberships", ["user_id"])
    op.create_table("messages",
        sa.Column("sequence", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("id", sa.String(36), nullable=False, unique=True),
        sa.Column("room_id", sa.String(36), sa.ForeignKey("rooms.id", ondelete="CASCADE"), nullable=False),
        sa.Column("author_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("client_message_id", sa.String(100), nullable=False),
        sa.Column("source", sa.String(10), nullable=False),
        sa.Column("speaker", sa.String(1)),
        sa.Column("source_language", sa.String(5)),
        sa.Column("target_language", sa.String(5)),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("translation", sa.Text()),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("error_code", sa.String(40)),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("room_id", "author_id", "client_message_id"),
        sqlite_autoincrement=True)
    op.create_index("ix_messages_room_sequence", "messages", ["room_id", "sequence"])


def downgrade():
    for table in ("messages", "memberships", "rooms", "sessions", "users"):
        op.drop_table(table)
