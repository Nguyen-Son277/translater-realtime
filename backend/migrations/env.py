from alembic import context

from app.config import Settings
from app.db import Database
from app.models import Base


def run(connection):
    context.configure(connection=connection, target_metadata=Base.metadata, render_as_batch=True)
    with context.begin_transaction():
        context.run_migrations()


connection = context.config.attributes.get("connection")
if connection is not None:
    run(connection)
else:
    settings = Settings()
    settings.prepare_directories()
    database = Database(settings.database_url)
    with database.engine.connect() as connection:
        run(connection)
