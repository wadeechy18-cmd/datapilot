from app.email.provider import EmailProvider
from app.services import auth_service


class CapturingEmailProvider(EmailProvider):
    def __init__(self) -> None:
        self.sent: list[dict] = []

    def send_email(self, to: str, subject: str, body: str) -> None:
        self.sent.append({"to": to, "subject": subject, "body": body})


def _extract_token(email_body: str) -> str:
    # Both verification and reset emails render "...?token=<token>\n..."
    return email_body.split("token=")[1].split("\n")[0].strip()


def _register(client, monkeypatch, email="user@example.com", password="correcthorse123"):
    capturing = CapturingEmailProvider()
    monkeypatch.setattr(auth_service, "get_email_provider", lambda: capturing)
    response = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password, "full_name": "Test User"},
    )
    return response, capturing


def test_register_creates_user_and_returns_tokens(client, monkeypatch):
    response, capturing = _register(client, monkeypatch)

    assert response.status_code == 201
    body = response.json()
    assert body["user"]["email"] == "user@example.com"
    assert body["user"]["is_email_verified"] is False
    assert body["access_token"]
    assert body["refresh_token"]
    assert len(capturing.sent) == 1
    assert capturing.sent[0]["subject"] == "Verify your ExcelAI email"


def test_register_rejects_duplicate_email(client, monkeypatch):
    _register(client, monkeypatch)
    response, _ = _register(client, monkeypatch)

    assert response.status_code == 409


def test_login_succeeds_with_correct_credentials(client, monkeypatch):
    _register(client, monkeypatch)

    response = client.post(
        "/api/v1/auth/login", json={"email": "user@example.com", "password": "correcthorse123"}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["access_token"]
    assert body["refresh_token"]


def test_login_rejects_wrong_password(client, monkeypatch):
    _register(client, monkeypatch)

    response = client.post(
        "/api/v1/auth/login", json={"email": "user@example.com", "password": "wrong-password"}
    )

    assert response.status_code == 401


def test_login_rejects_unknown_email(client):
    response = client.post(
        "/api/v1/auth/login", json={"email": "nobody@example.com", "password": "whatever123"}
    )

    assert response.status_code == 401


def test_me_requires_valid_access_token(client, monkeypatch):
    register_response, _ = _register(client, monkeypatch)
    access_token = register_response.json()["access_token"]

    unauthenticated = client.get("/api/v1/auth/me")
    authenticated = client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {access_token}"}
    )
    bad_token = client.get(
        "/api/v1/auth/me", headers={"Authorization": "Bearer not-a-real-token"}
    )

    # FastAPI's HTTPBearer returns 403 for a missing Authorization header
    # and reserves 401 for a header that's present but fails validation.
    assert unauthenticated.status_code == 403
    assert authenticated.status_code == 200
    assert authenticated.json()["email"] == "user@example.com"
    assert bad_token.status_code == 401


def test_refresh_rotates_token_and_invalidates_the_old_one(client, monkeypatch):
    register_response, _ = _register(client, monkeypatch)
    old_refresh_token = register_response.json()["refresh_token"]

    first_refresh = client.post("/api/v1/auth/refresh", json={"refresh_token": old_refresh_token})
    assert first_refresh.status_code == 200
    new_refresh_token = first_refresh.json()["refresh_token"]
    assert new_refresh_token != old_refresh_token

    reuse_old = client.post("/api/v1/auth/refresh", json={"refresh_token": old_refresh_token})
    assert reuse_old.status_code == 401

    use_new = client.post("/api/v1/auth/refresh", json={"refresh_token": new_refresh_token})
    assert use_new.status_code == 200


def test_logout_revokes_the_refresh_token(client, monkeypatch):
    register_response, _ = _register(client, monkeypatch)
    refresh_token = register_response.json()["refresh_token"]

    logout_response = client.post("/api/v1/auth/logout", json={"refresh_token": refresh_token})
    assert logout_response.status_code == 200

    reuse_after_logout = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert reuse_after_logout.status_code == 401


def test_verify_email_marks_user_verified(client, monkeypatch):
    register_response, capturing = _register(client, monkeypatch)
    access_token = register_response.json()["access_token"]
    token = _extract_token(capturing.sent[0]["body"])

    response = client.post("/api/v1/auth/verify-email", json={"token": token})
    assert response.status_code == 200

    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {access_token}"})
    assert me.json()["is_email_verified"] is True


def test_verify_email_rejects_garbage_token(client):
    response = client.post("/api/v1/auth/verify-email", json={"token": "garbage"})
    assert response.status_code == 400


def test_forgot_password_responds_the_same_for_known_and_unknown_email(client, monkeypatch):
    _register(client, monkeypatch)
    capturing = CapturingEmailProvider()
    monkeypatch.setattr(auth_service, "get_email_provider", lambda: capturing)

    known = client.post("/api/v1/auth/forgot-password", json={"email": "user@example.com"})
    unknown = client.post("/api/v1/auth/forgot-password", json={"email": "nobody@example.com"})

    assert known.status_code == 200
    assert unknown.status_code == 200
    assert known.json() == unknown.json()
    # Only the real user actually gets an email.
    assert len(capturing.sent) == 1
    assert capturing.sent[0]["to"] == "user@example.com"


def test_reset_password_changes_password_and_revokes_sessions(client, monkeypatch):
    register_response, _ = _register(client, monkeypatch)
    old_refresh_token = register_response.json()["refresh_token"]

    capturing = CapturingEmailProvider()
    monkeypatch.setattr(auth_service, "get_email_provider", lambda: capturing)
    client.post("/api/v1/auth/forgot-password", json={"email": "user@example.com"})
    reset_token = _extract_token(capturing.sent[0]["body"])

    reset_response = client.post(
        "/api/v1/auth/reset-password", json={"token": reset_token, "new_password": "new-password-1"}
    )
    assert reset_response.status_code == 200

    # Old refresh token no longer works after a password reset.
    old_refresh_still_works = client.post(
        "/api/v1/auth/refresh", json={"refresh_token": old_refresh_token}
    )
    assert old_refresh_still_works.status_code == 401

    old_password_login = client.post(
        "/api/v1/auth/login", json={"email": "user@example.com", "password": "correcthorse123"}
    )
    assert old_password_login.status_code == 401

    new_password_login = client.post(
        "/api/v1/auth/login", json={"email": "user@example.com", "password": "new-password-1"}
    )
    assert new_password_login.status_code == 200


def test_reset_password_rejects_garbage_token(client):
    response = client.post(
        "/api/v1/auth/reset-password", json={"token": "garbage", "new_password": "new-password-1"}
    )
    assert response.status_code == 400
