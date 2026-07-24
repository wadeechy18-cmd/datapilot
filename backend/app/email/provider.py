"""
Email provider abstraction, mirroring app/ai/provider.py's shape: the rest
of the app depends only on this interface, never a specific vendor's SDK,
so switching providers (console -> a real transactional-email service
later) is a config change (EMAIL_PROVIDER env var), not a business-logic
rewrite.
"""

from abc import ABC, abstractmethod


class EmailProviderError(Exception):
    """Raised when sending fails -- callers translate this into an HTTP
    error, not a crash."""


class EmailProvider(ABC):
    @abstractmethod
    def send_email(self, to: str, subject: str, body: str) -> None:
        """Sends a plain-text email. Raises EmailProviderError on failure."""
