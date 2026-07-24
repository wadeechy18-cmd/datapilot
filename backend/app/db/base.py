"""
Shared SQLAlchemy declarative base.

Kept in its own module (rather than alongside the engine/session, or
inside models.py) so that both app/db/models.py and Alembic's env.py can
import it without a circular import.
"""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass
