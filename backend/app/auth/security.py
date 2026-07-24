"""
Password hashing, JWT access tokens, and single-use purpose tokens
(email verification / password reset).

Plain `bcrypt` (not passlib) -- passlib's bcrypt backend has had
compatibility breaks against newer bcrypt releases, and this app only
needs hash/verify, so the extra abstraction layer isn't worth it.
"""

import hashlib
import secrets
import uuid
from datetime import timedelta
from enum import Enum

import bcrypt
import jwt

from app.core.config import get_settings
from app.utils.time import utcnow

_BCRYPT_MAX_PASSWORD_BYTES = 72


class TokenPurpose(str, Enum):
    ACCESS = "access"
    EMAIL_VERIFY = "email_verify"
    PASSWORD_RESET = "password_reset"


class InvalidTokenError(Exception):
    pass


def hash_password(password: str) -> str:
    if len(password.encode("utf-8")) > _BCRYPT_MAX_PASSWORD_BYTES:
        raise ValueError(f"Password must be at most {_BCRYPT_MAX_PASSWORD_BYTES} bytes")
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed_password.encode("utf-8"))
    except ValueError:
        return False


def _encode(payload: dict) -> str:
    settings = get_settings()
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def _decode(token: str) -> dict:
    settings = get_settings()
    try:
        return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except jwt.PyJWTError as exc:
        raise InvalidTokenError(str(exc)) from exc


def create_access_token(user_id: uuid.UUID) -> str:
    settings = get_settings()
    now = utcnow()
    payload = {
        "sub": str(user_id),
        "purpose": TokenPurpose.ACCESS.value,
        "iat": now,
        "exp": now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    return _encode(payload)


def decode_access_token(token: str) -> uuid.UUID:
    payload = _decode(token)
    if payload.get("purpose") != TokenPurpose.ACCESS.value:
        raise InvalidTokenError("Token is not an access token")
    return uuid.UUID(payload["sub"])


def create_purpose_token(user_id: uuid.UUID, purpose: TokenPurpose, expires_delta: timedelta) -> str:
    now = utcnow()
    payload = {
        "sub": str(user_id),
        "purpose": purpose.value,
        "iat": now,
        "exp": now + expires_delta,
    }
    return _encode(payload)


def decode_purpose_token(token: str, expected_purpose: TokenPurpose) -> uuid.UUID:
    payload = _decode(token)
    if payload.get("purpose") != expected_purpose.value:
        raise InvalidTokenError(f"Token is not a {expected_purpose.value} token")
    return uuid.UUID(payload["sub"])


def generate_refresh_token() -> str:
    """A random opaque string, not a JWT -- its DB row (see app/db/models.py)
    is the source of truth for who it belongs to and whether it's revoked,
    so it doesn't need to carry claims itself."""
    return secrets.token_urlsafe(48)


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
