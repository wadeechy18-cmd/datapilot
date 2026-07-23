import datetime
import io

import openpyxl
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app

client = TestClient(app)


def _upload_sheets(sheets: dict[str, list[list]]) -> tuple[str, bytes]:
    wb = openpyxl.Workbook()
    wb.remove(wb.active)
    for name, rows in sheets.items():
        ws = wb.create_sheet(title=name)
        for row in rows:
            ws.append(row)

    buffer = io.BytesIO()
    wb.save(buffer)
    content = buffer.getvalue()

    response = client.post(
        "/api/v1/upload",
        files={
            "file": (
                "test.xlsx",
                content,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )
    assert response.status_code == 201
    return response.json()["file_id"], content


def test_export_xlsx_returns_original_bytes(tmp_path, monkeypatch):
    monkeypatch.setattr(get_settings(), "STORAGE_DIR", tmp_path)

    file_id, original_content = _upload_sheets({"Data": [["A", "B"], [1, 2]]})

    response = client.get(f"/api/v1/workbook/{file_id}/export/xlsx")

    assert response.status_code == 200
    assert response.content == original_content
    assert response.headers["content-type"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    assert f'filename="{file_id}.xlsx"' in response.headers["content-disposition"]


def test_export_xlsx_missing_file_returns_404(tmp_path, monkeypatch):
    monkeypatch.setattr(get_settings(), "STORAGE_DIR", tmp_path)

    response = client.get("/api/v1/workbook/does-not-exist/export/xlsx")

    assert response.status_code == 404


def test_export_csv_returns_flattened_data(tmp_path, monkeypatch):
    monkeypatch.setattr(get_settings(), "STORAGE_DIR", tmp_path)

    file_id, _ = _upload_sheets({"Data": [["Name", "Score"], ["Alice", 1], ["Bob", 2]]})

    response = client.get(f"/api/v1/workbook/{file_id}/export/csv", params={"sheet_name": "Data"})

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert f'filename="{file_id}_Data.csv"' in response.headers["content-disposition"]
    assert response.text.splitlines() == ["Name,Score", "Alice,1", "Bob,2"]


def test_export_csv_normalizes_date_values(tmp_path, monkeypatch):
    monkeypatch.setattr(get_settings(), "STORAGE_DIR", tmp_path)

    file_id, _ = _upload_sheets({"Data": [["When"], [datetime.date(2026, 1, 15)]]})

    response = client.get(f"/api/v1/workbook/{file_id}/export/csv", params={"sheet_name": "Data"})

    assert response.status_code == 200
    assert response.text.splitlines() == ["When", "2026-01-15T00:00:00"]


def test_export_csv_sanitizes_sheet_name_in_filename(tmp_path, monkeypatch):
    monkeypatch.setattr(get_settings(), "STORAGE_DIR", tmp_path)

    file_id, _ = _upload_sheets({"My Data": [["A"], [1]]})

    response = client.get(f"/api/v1/workbook/{file_id}/export/csv", params={"sheet_name": "My Data"})

    assert response.status_code == 200
    assert f'filename="{file_id}_My_Data.csv"' in response.headers["content-disposition"]


def test_export_csv_invalid_sheet_name_returns_400(tmp_path, monkeypatch):
    monkeypatch.setattr(get_settings(), "STORAGE_DIR", tmp_path)

    file_id, _ = _upload_sheets({"Data": [["A"], [1]]})

    response = client.get(f"/api/v1/workbook/{file_id}/export/csv", params={"sheet_name": "DoesNotExist"})

    assert response.status_code == 400


def test_export_csv_missing_file_returns_404(tmp_path, monkeypatch):
    monkeypatch.setattr(get_settings(), "STORAGE_DIR", tmp_path)

    response = client.get("/api/v1/workbook/does-not-exist/export/csv", params={"sheet_name": "Data"})

    assert response.status_code == 404
