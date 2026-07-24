"""
Auth endpoints: register, login, logout, refresh, forgot/reset password,
email verification, and the protected /auth/me route.

Thin by design, matching every other router in this app: business logic
lives in auth_service, this module only translates service-layer
exceptions into HTTP responses.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.db.models import User
from app.db.session import get_db
from app.schemas.auth import (
    AccessTokenResponse,
    ForgotPasswordRequest,
    LoginRequest,
    LogoutRequest,
    MessageResponse,
    RefreshRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
    UserResponse,
    VerifyEmailRequest,
)
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(request: RegisterRequest, db: Session = Depends(get_db)) -> TokenResponse:
    try:
        user = auth_service.register_user(db, request.email, request.password, request.full_name)
    except auth_service.EmailAlreadyRegisteredError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    tokens = auth_service.issue_tokens(db, user)
    return TokenResponse(
        access_token=tokens.access_token,
        refresh_token=tokens.refresh_token,
        user=UserResponse.model_validate(user),
    )


@router.post("/login", response_model=TokenResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    try:
        user = auth_service.authenticate_user(db, request.email, request.password)
    except auth_service.InvalidCredentialsError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    tokens = auth_service.issue_tokens(db, user)
    return TokenResponse(
        access_token=tokens.access_token,
        refresh_token=tokens.refresh_token,
        user=UserResponse.model_validate(user),
    )


@router.post("/logout", response_model=MessageResponse)
def logout(request: LogoutRequest, db: Session = Depends(get_db)) -> MessageResponse:
    auth_service.revoke_refresh_token(db, request.refresh_token)
    return MessageResponse(message="Logged out.")


@router.post("/refresh", response_model=AccessTokenResponse)
def refresh(request: RefreshRequest, db: Session = Depends(get_db)) -> AccessTokenResponse:
    try:
        tokens = auth_service.refresh_access_token(db, request.refresh_token)
    except auth_service.InvalidRefreshTokenError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    return AccessTokenResponse(access_token=tokens.access_token, refresh_token=tokens.refresh_token)


@router.post("/forgot-password", response_model=MessageResponse)
def forgot_password(request: ForgotPasswordRequest, db: Session = Depends(get_db)) -> MessageResponse:
    auth_service.request_password_reset(db, request.email)
    # Same response whether or not the email is registered -- see
    # auth_service.request_password_reset's docstring.
    return MessageResponse(message="If that email is registered, a reset link has been sent.")


@router.post("/reset-password", response_model=MessageResponse)
def reset_password(request: ResetPasswordRequest, db: Session = Depends(get_db)) -> MessageResponse:
    try:
        auth_service.reset_password(db, request.token, request.new_password)
    except auth_service.InvalidResetTokenError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return MessageResponse(message="Password has been reset.")


@router.post("/verify-email", response_model=MessageResponse)
def verify_email(request: VerifyEmailRequest, db: Session = Depends(get_db)) -> MessageResponse:
    try:
        auth_service.verify_email(db, request.token)
    except auth_service.InvalidVerificationTokenError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return MessageResponse(message="Email verified.")


@router.get("/me", response_model=UserResponse)
def read_current_user(current_user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse.model_validate(current_user)
