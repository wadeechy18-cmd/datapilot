"""
Provider factory.

The single place that knows which concrete AIProvider to construct.
Everything else in the app depends on the AIProvider interface only --
switching providers is changing AI_PROVIDER (and its matching API key) in
the environment, not editing business logic.
"""

from app.ai.provider import AIProvider, AIProviderError
from app.ai.gemini_provider import GeminiProvider
from app.core.config import get_settings


def get_ai_provider() -> AIProvider:
    settings = get_settings()
    provider = settings.AI_PROVIDER.lower()

    if provider == "gemini":
        return GeminiProvider(api_key=settings.GEMINI_API_KEY, model=settings.GEMINI_MODEL)

    raise AIProviderError(f"Unknown AI_PROVIDER '{settings.AI_PROVIDER}'.")
