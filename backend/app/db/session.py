"""
Database engine and session management.

One process-wide engine/connection pool, created once at import time (the
standard SQLAlchemy pattern -- unlike settings elsewhere in this app,
re-reading the DB URL per-request would just mean reconnecting every time).
Tests don't monkeypatch DATABASE_URL for this reason; they override the
get_db dependency instead (see app/tests/conftest.py).
"""

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings

settings = get_settings()

engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
