"""Durable administrator bootstrap, never a runtime username allowlist."""
from pydantic import TypeAdapter, ValidationError
from sqlalchemy import select

from app.auth import passwords
from app.models import User
from app.schemas import Credentials, EmailAddress


def bootstrap_admin(database, settings):
    with database.session() as db:
        if db.scalar(select(User.id).where(User.is_admin.is_(True), User.is_guest.is_(False))):
            return
        try:
            username = Credentials.normalize_username(settings.bootstrap_admin_username)
        except ValueError:
            raise RuntimeError("A valid BOOTSTRAP_ADMIN_USERNAME is required for initial setup.") from None
        user = db.scalar(select(User).where(User.username == username))
        if user:
            if user.is_guest:
                raise RuntimeError("The bootstrap administrator cannot be a guest account.")
            # Promote explicitly selected existing accounts without replacing their
            # password/profile, unlocking them or reviving any sessions.
            user.is_admin = True
        else:
            try:
                Credentials(username=username, password=settings.bootstrap_admin_password)
                email = (TypeAdapter(EmailAddress).validate_python(settings.bootstrap_admin_email)
                         if settings.bootstrap_admin_email else None)
            except ValidationError:
                raise RuntimeError("Valid bootstrap administrator credentials are required for initial setup.") from None
            name = settings.bootstrap_admin_name.strip()
            if not name or len(name) > 100:
                raise RuntimeError("BOOTSTRAP_ADMIN_NAME must contain 1–100 characters.")
            db.add(User(username=username, name=name, email=email,
                        password_hash=passwords.hash(settings.bootstrap_admin_password), is_admin=True))
        db.commit()
