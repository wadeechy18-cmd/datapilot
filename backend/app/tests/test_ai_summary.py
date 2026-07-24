import io

import openpyxl
import pytest
from fastapi.testclient import TestClient

import app.services.ai_summary_service as ai_summary_service
from app.ai.provider import AIProvider, AIProviderError
from app.core.config import get_settings
from app.main import app

client = TestClient(app)


class FakeAIProvider(AIProvider):
    def __init__(self, response: str = "This is a fake summary.", error: Exception | None = None):
        self._response = response
        self._error = error

    async def generate_text(self, prompt: str) -> str:
        if self._error:
            raise self._error
        return self._response


class CapturingAIProvider(AIProvider):
    """Records the prompt it was sent, so tests can assert what data does
    (and doesn't) get sent to the AI provider."""

    def __init__(self):
        self.last_prompt: str | None = None

    async def generate_text(self, prompt: str) -> str:
        self.last_prompt = prompt
        return "captured"


def _upload_sheets(sheets: dict[str, list[list]]) -> str:
    wb = openpyxl.Workbook()
    wb.remove(wb.active)
    for name, rows in sheets.items():
        ws = wb.create_sheet(title=name)
        for row in rows:
            ws.append(row)

    buffer = io.BytesIO()
    wb.save(buffer)

    response = client.post(
        "/api/v1/upload",
        files={
            "file": (
                "test.xlsx",
                buffer.getvalue(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )
    assert response.status_code == 201
    return response.json()["file_id"]


def _summarize(file_id: str, request: dict | None = None):
    return client.post(f"/api/v1/workbook/{file_id}/summarize", json=request or {})


def test_summarize_returns_ai_text(tmp_path, monkeypatch):
    monkeypatch.setattr(get_settings(), "STORAGE_DIR", tmp_path)
    monkeypatch.setattr(ai_summary_service, "get_ai_provider", lambda: FakeAIProvider("Fake summary text."))

    file_id = _upload_sheets({"Data": [["Name", "Age"], ["Alice", 30], ["Bob", 25]]})

    response = _summarize(file_id)

    assert response.status_code == 200
    body = response.json()
    assert body["file_id"] == file_id
    assert body["sheet_name"] == "Data"
    assert body["summary"] == "Fake summary text."


def test_summarize_defaults_to_first_sheet(tmp_path, monkeypatch):
    monkeypatch.setattr(get_settings(), "STORAGE_DIR", tmp_path)
    monkeypatch.setattr(ai_summary_service, "get_ai_provider", lambda: FakeAIProvider("ok"))

    file_id = _upload_sheets({"Sheet1": [["A"], [1]], "Sheet2": [["B"], [2]]})

    response = _summarize(file_id)
    assert response.status_code == 200
    assert response.json()["sheet_name"] == "Sheet1"


def test_summarize_specific_sheet(tmp_path, monkeypatch):
    monkeypatch.setattr(get_settings(), "STORAGE_DIR", tmp_path)
    monkeypatch.setattr(ai_summary_service, "get_ai_provider", lambda: FakeAIProvider("ok"))

    file_id = _upload_sheets({"Sheet1": [["A"], [1]], "Sheet2": [["B"], [2]]})

    response = _summarize(file_id, {"sheet_name": "Sheet2"})
    assert response.status_code == 200
    assert response.json()["sheet_name"] == "Sheet2"


def test_summarize_prompt_omits_raw_row_and_text_data(tmp_path, monkeypatch):
    """Data-minimization policy, enforced: the AI provider only ever sees
    column-level statistics, never raw row data or text-cell values. Note
    numeric aggregates (min/max/mean/sum) *are* sent by design -- that's
    what "column statistics, not raw data" means -- and min/max are
    inherently individual data points, not obscuring aggregates, so this
    deliberately doesn't assert numbers are absent, only that text values
    and the row-by-row structure never appear."""
    monkeypatch.setattr(get_settings(), "STORAGE_DIR", tmp_path)
    capturing = CapturingAIProvider()
    monkeypatch.setattr(ai_summary_service, "get_ai_provider", lambda: capturing)

    file_id = _upload_sheets(
        {
            "Data": [
                ["Name", "Secret"],
                ["UNIQUE_SECRET_VALUE_ALICE", 111],
                ["UNIQUE_SECRET_VALUE_BOB", 222],
                ["UNIQUE_SECRET_VALUE_CAROL", 333],
            ]
        }
    )

    _summarize(file_id)

    assert capturing.last_prompt is not None
    assert "UNIQUE_SECRET_VALUE_ALICE" not in capturing.last_prompt
    assert "UNIQUE_SECRET_VALUE_BOB" not in capturing.last_prompt
    assert "UNIQUE_SECRET_VALUE_CAROL" not in capturing.last_prompt
    assert "Name" in capturing.last_prompt
    assert "Secret" in capturing.last_prompt
    # The numeric column's aggregates ARE expected to be present -- that's
    # the intended "statistics, not raw data" behavior, not a leak.
    assert "min=111" in capturing.last_prompt
    assert "mean=222.00" in capturing.last_prompt


def test_summarize_invalid_sheet_returns_400(tmp_path, monkeypatch):
    monkeypatch.setattr(get_settings(), "STORAGE_DIR", tmp_path)
    monkeypatch.setattr(ai_summary_service, "get_ai_provider", lambda: FakeAIProvider("ok"))

    file_id = _upload_sheets({"Data": [["A"], [1]]})

    response = _summarize(file_id, {"sheet_name": "DoesNotExist"})
    assert response.status_code == 400


def test_summarize_missing_file_returns_404(tmp_path, monkeypatch):
    monkeypatch.setattr(get_settings(), "STORAGE_DIR", tmp_path)
    monkeypatch.setattr(ai_summary_service, "get_ai_provider", lambda: FakeAIProvider("ok"))

    response = _summarize("does-not-exist")
    assert response.status_code == 404


def test_summarize_provider_error_returns_502(tmp_path, monkeypatch):
    monkeypatch.setattr(get_settings(), "STORAGE_DIR", tmp_path)
    monkeypatch.setattr(
        ai_summary_service, "get_ai_provider", lambda: FakeAIProvider(error=AIProviderError("boom"))
    )

    file_id = _upload_sheets({"Data": [["A"], [1]]})

    response = _summarize(file_id)
    assert response.status_code == 502


def test_gemini_provider_requires_api_key():
    from app.ai.gemini_provider import GeminiProvider

    with pytest.raises(AIProviderError):
        GeminiProvider(api_key="", model="gemini-2.0-flash")
