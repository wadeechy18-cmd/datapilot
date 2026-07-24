"""
AI provider abstraction.

The rest of the app must depend only on this interface, never on a specific
vendor's SDK/API directly -- see the project's AI architecture policy:
switching providers (Gemini -> OpenAI -> Claude -> a future local model) is
meant to be a pure configuration change (AI_PROVIDER env var), never a
business-logic rewrite. Deliberately minimal (one method, plain text in,
plain text out) rather than summary-specific, so the next AI feature (e.g.
natural-language formula generation) reuses this without a redesign.
"""

from abc import ABC, abstractmethod


class AIProviderError(Exception):
    """Raised when a provider call fails (network error, API error, missing
    configuration) -- callers translate this into an HTTP error, not a crash."""


class AIProvider(ABC):
    @abstractmethod
    async def generate_text(self, prompt: str) -> str:
        """Sends `prompt` to the provider and returns its plain-text response."""
