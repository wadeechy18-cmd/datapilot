import io

import openpyxl
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app

client = TestClient(app)


def _make_valid_xlsx_bytes() -> bytes:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws["A1"] = "hello"
    buffer = io.BytesIO()
    wb.save(buffer)
    return buffer.getvalue()


def test_upload_valid_xlsx_succeeds(tmp_path, monkeypatch):
    monkeypatch.setattr(get_settings(), "STORAGE_DIR", tmp_path)

    content = _make_valid_xlsx_bytes()
    response = client.post(
        "/api/v1/upload",
        files={"file": ("test.xlsx", content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["original_filename"] == "test.xlsx"
    assert body["size_bytes"] == len(content)
    assert body["file_id"]
    assert (tmp_path / f"{body['file_id']}.xlsx").exists()


def test_upload_rejects_wrong_extension(tmp_path, monkeypatch):
    monkeypatch.setattr(get_settings(), "STORAGE_DIR", tmp_path)

    response = client.post(
        "/api/v1/upload",
        files={"file": ("test.txt", b"not an excel file", "text/plain")},
    )

    assert response.status_code == 400
    assert "Unsupported file type" in response.json()["detail"]


def test_upload_rejects_corrupt_xlsx(tmp_path, monkeypatch):
    monkeypatch.setattr(get_settings(), "STORAGE_DIR", tmp_path)

    response = client.post(
        "/api/v1/upload",
        files={"file": ("test.xlsx", b"this is not really an xlsx file", "application/octet-stream")},
    )

    assert response.status_code == 400
    assert "valid Excel workbook" in response.json()["detail"]


def test_upload_rejects_empty_file(tmp_path, monkeypatch):
    monkeypatch.setattr(get_settings(), "STORAGE_DIR", tmp_path)

    response = client.post(
        "/api/v1/upload",
        files={"file": ("test.xlsx", b"", "application/octet-stream")},
    )

    assert response.status_code == 400
    assert "empty" in response.json()["detail"]
