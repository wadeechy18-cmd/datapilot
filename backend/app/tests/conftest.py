"""
Shared test fixtures for DB-backed tests.

Uses a real Postgres database (excelai_test, created alongside the dev
database) rather than mocks/SQLite -- consistent with this project's
existing testing style of exercising real behavior (e.g. reading actual
.xlsx files with openpyxl) instead of faking it.

Each test runs inside an outer transaction that's rolled back afterward
(the standard SQLAlchemy "join a session into an external transaction"
recipe: a SAVEPOINT is restarted after every commit so the service layer's
own db.commit() calls don't escape the outer, always-rolled-back
transaction). This keeps tests isolated from each other without recreating
the schema every time.
"""

from urllib.parse import urlsplit, urlunsplit

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings
from app.db import models  # noqa: F401 -- registers tables on Base.metadata
from app.db.base import Base
from app.db.session import get_db
from app.main import app


def _test_database_url() -> str:
    parts = urlsplit(get_settings().DATABASE_URL)
    test_path = parts.path.rstrip("/") + "_test"
    return urlunsplit((parts.scheme, parts.netloc, test_path, parts.query, parts.fragment))


_engine = create_engine(_test_database_url())
_TestSessionLocal = sessionmaker(bind=_engine, autoflush=False, autocommit=False)


@pytest.fixture(scope="session", autouse=True)
def _test_schema():
    Base.metadata.create_all(bind=_engine)
    yield
    Base.metadata.drop_all(bind=_engine)


@pytest.fixture
def db_session():
    connection = _engine.connect()
    outer_transaction = connection.begin()
    session = _TestSessionLocal(bind=connection)
    session.begin_nested()

    @event.listens_for(session, "after_transaction_end")
    def _restart_savepoint(session: Session, transaction) -> None:
        if transaction.nested and not transaction._parent.nested:
            session.begin_nested()

    yield session

    session.close()
    outer_transaction.rollback()
    connection.close()


@pytest.fixture
def client(db_session):
    def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    yield TestClient(app)
    app.dependency_overrides.pop(get_db, None)
