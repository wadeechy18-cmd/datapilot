"""
Auth business logic: registration, login, token issuance/refresh/revocation,
password reset, and email verification.

Following this codebase's existing service-layer convention (see
upload_service.py): domain errors are raised as plain exceptions here, and
the API layer (app/api/auth.py) is the only place that translates them into
HTTP responses.
"""

import uuid
from dataclasses import dataclass
from datetime import timedelta

from sqlalchemy.orm import Session

from app.auth.security import (
    InvalidTokenError,
    TokenPurpose,
    create_access_token,
    create_purpose_token,
    decode_purpose_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)
from app.core.config import get_settings
from app.db.models import RefreshToken, User
from app.email.factory import get_email_provider
from app.utils.time import utcnow


class EmailAlreadyRegisteredError(Exception):
    pass


class InvalidCredentialsError(Exception):
    pass


class InvalidRefreshTokenError(Exception):
    pass


class InvalidResetTokenError(Exception):
    pass


class InvalidVerificationTokenError(Exception):
    pass


@dataclass
class IssuedTokens:
    access_token: str
    refresh_token: str


def register_user(db: Session, email: str, password: str, full_name: str | None) -> User:
    email = email.strip().lower()
    if db.query(User).filter(User.email == email).first() is not None:
        raise EmailAlreadyRegisteredError(f"Email '{email}' is already registered.")

    user = User(email=email, hashed_password=hash_password(password), full_name=full_name)
    db.add(user)
    db.commit()
    db.refresh(user)

    _send_verification_email(user)
    return user


def authenticate_user(db: Session, email: str, password: str) -> User:
    email = email.strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if user is None or not user.is_active or not verify_password(password, user.hashed_password):
        raise InvalidCredentialsError("Incorrect email or password.")
    return user


def issue_tokens(db: Session, user: User) -> IssuedTokens:
    settings = get_settings()
    access_token = create_access_token(user.id)

    raw_refresh_token = generate_refresh_token()
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=hash_refresh_token(raw_refresh_token),
            expires_at=utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        )
    )
    db.commit()

    return IssuedTokens(access_token=access_token, refresh_token=raw_refresh_token)


def refresh_access_token(db: Session, raw_refresh_token: str) -> IssuedTokens:
    """Validates the refresh token and rotates it: the old one is revoked
    and a new one issued, so a leaked-and-later-replayed token is
    detectable (the legitimate client's next refresh will fail)."""
    token_row = _get_valid_refresh_token(db, raw_refresh_token)
    if token_row is None:
        raise InvalidRefreshTokenError("Refresh token is invalid, expired, or revoked.")

    user = db.get(User, token_row.user_id)
    if user is None or not user.is_active:
        raise InvalidRefreshTokenError("Refresh token is invalid, expired, or revoked.")

    token_row.revoked = True
    db.add(token_row)
    db.commit()

    return issue_tokens(db, user)


def revoke_refresh_token(db: Session, raw_refresh_token: str) -> None:
    token_row = _get_valid_refresh_token(db, raw_refresh_token)
    if token_row is not None:
        token_row.revoked = True
        db.add(token_row)
        db.commit()


def _get_valid_refresh_token(db: Session, raw_refresh_token: str) -> RefreshToken | None:
    token_row = (
        db.query(RefreshToken)
        .filter(RefreshToken.token_hash == hash_refresh_token(raw_refresh_token))
        .first()
    )
    if token_row is None or token_row.revoked or token_row.expires_at < utcnow():
        return None
    return token_row


def request_password_reset(db: Session, email: str) -> None:
    """Always succeeds from the caller's perspective, whether or not the
    email exists -- this must not leak which emails are registered."""
    email = email.strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        return

    settings = get_settings()
    token = create_purpose_token(
        user.id,
        TokenPurpose.PASSWORD_RESET,
        timedelta(minutes=settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES),
    )
    reset_link = f"{settings.FRONTEND_URL}/reset-password?token={token}"
    get_email_provider().send_email(
        to=user.email,
        subject="Reset your ExcelAI password",
        body=f"Reset your password: {reset_link}\nThis link expires in "
        f"{settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES} minutes.",
    )


def reset_password(db: Session, token: str, new_password: str) -> None:
    try:
        user_id = decode_purpose_token(token, TokenPurpose.PASSWORD_RESET)
    except InvalidTokenError as exc:
        raise InvalidResetTokenError("Reset token is invalid or expired.") from exc

    user = db.get(User, user_id)
    if user is None:
        raise InvalidResetTokenError("Reset token is invalid or expired.")

    user.hashed_password = hash_password(new_password)
    db.add(user)
    # Any password reset revokes every existing session -- a leaked
    # refresh token stops being useful once the password is changed.
    db.query(RefreshToken).filter(RefreshToken.user_id == user.id).update({"revoked": True})
    db.commit()


def verify_email(db: Session, token: str) -> None:
    try:
        user_id = decode_purpose_token(token, TokenPurpose.EMAIL_VERIFY)
    except InvalidTokenError as exc:
        raise InvalidVerificationTokenError("Verification token is invalid or expired.") from exc

    user = db.get(User, user_id)
    if user is None:
        raise InvalidVerificationTokenError("Verification token is invalid or expired.")

    user.is_email_verified = True
    db.add(user)
    db.commit()


def _send_verification_email(user: User) -> None:
    settings = get_settings()
    token = create_purpose_token(
        user.id,
        TokenPurpose.EMAIL_VERIFY,
        timedelta(hours=settings.EMAIL_VERIFICATION_TOKEN_EXPIRE_HOURS),
    )
    verify_link = f"{settings.FRONTEND_URL}/verify-email?token={token}"
    get_email_provider().send_email(
        to=user.email,
        subject="Verify your ExcelAI email",
        body=f"Verify your email: {verify_link}\nThis link expires in "
        f"{settings.EMAIL_VERIFICATION_TOKEN_EXPIRE_HOURS} hours.",
    )
