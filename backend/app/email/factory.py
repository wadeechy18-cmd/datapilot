"""
Provider factory -- the single place that knows which concrete
EmailProvider to construct. See app/ai/factory.py for the identical
pattern used for AI providers.
"""

from app.core.config import get_settings
from app.email.console_provider import ConsoleEmailProvider
from app.email.provider import EmailProvider, EmailProviderError


def get_email_provider() -> EmailProvider:
    settings = get_settings()
    provider = settings.EMAIL_PROVIDER.lower()

    if provider == "console":
        return ConsoleEmailProvider()

    raise EmailProviderError(f"Unknown EMAIL_PROVIDER '{settings.EMAIL_PROVIDER}'.")
