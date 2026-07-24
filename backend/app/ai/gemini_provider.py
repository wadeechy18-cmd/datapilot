"""
Gemini implementation of AIProvider.

Talks to the Gemini REST API directly via httpx (already a dependency for
this project's tests) rather than adding the google-generativeai SDK as a
new dependency for a single HTTP call.
"""

import httpx

from app.ai.provider import AIProvider, AIProviderError

_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"


class GeminiProvider(AIProvider):
    def __init__(self, api_key: str, model: str):
        if not api_key:
            raise AIProviderError(
                "GEMINI_API_KEY is not configured. Set it in backend/.env to enable AI features."
            )
        self._api_key = api_key
        self._model = model

    async def generate_text(self, prompt: str) -> str:
        url = f"{_API_BASE}/{self._model}:generateContent"
        body = {"contents": [{"parts": [{"text": prompt}]}]}

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, params={"key": self._api_key}, json=body)
        except httpx.HTTPError as exc:
            raise AIProviderError(f"Could not reach the Gemini API: {exc}") from exc

        if response.status_code != 200:
            detail = response.text
            try:
                detail = response.json().get("error", {}).get("message", detail)
            except ValueError:
                pass
            raise AIProviderError(f"Gemini API error ({response.status_code}): {detail}")

        payload = response.json()
        try:
            candidates = payload["candidates"]
            parts = candidates[0]["content"]["parts"]
            return "".join(part.get("text", "") for part in parts).strip()
        except (KeyError, IndexError) as exc:
            raise AIProviderError(f"Unexpected Gemini API response shape: {payload}") from exc
