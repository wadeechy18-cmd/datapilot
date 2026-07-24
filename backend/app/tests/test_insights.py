import io

import openpyxl
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app

client = TestClient(app)


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


def _insights(file_id: str, sheet_name: str | None = None):
    return client.post(f"/api/v1/workbook/{file_id}/insights", json={"sheet_name": sheet_name})


def test_detects_outlier(tmp_path, monkeypatch):
    monkeypatch.setattr(get_settings(), "STORAGE_DIR", tmp_path)

    file_id = _upload_sheets({"Data": [["Value"], [10], [12], [11], [13], [9], [1000]]})

    response = _insights(file_id, "Data")

    assert response.status_code == 200
    body = response.json()
    outlier = next(o for o in body["outliers"] if o["column"] == "Value")
    assert outlier["outlier_count"] == 1
    assert 1000 in outlier["sample_values"]


def test_no_outliers_for_uniform_data(tmp_path, monkeypatch):
    monkeypatch.setattr(get_settings(), "STORAGE_DIR", tmp_path)

    file_id = _upload_sheets({"Data": [["Value"], [10], [11], [12], [10], [11], [12]]})

    response = _insights(file_id, "Data")

    assert response.status_code == 200
    assert response.json()["outliers"] == []


def test_detects_duplicate_rows(tmp_path, monkeypatch):
    monkeypatch.setattr(get_settings(), "STORAGE_DIR", tmp_path)

    file_id = _upload_sheets(
        {"Data": [["Name", "Score"], ["Alice", 10], ["Bob", 20], ["Alice", 10], ["Alice", 10]]}
    )

    response = _insights(file_id, "Data")

    assert response.status_code == 200
    # Two extra occurrences of the ("Alice", 10) row beyond the first.
    assert response.json()["duplicate_row_count"] == 2


def test_no_duplicate_rows(tmp_path, monkeypatch):
    monkeypatch.setattr(get_settings(), "STORAGE_DIR", tmp_path)

    file_id = _upload_sheets({"Data": [["Name"], ["Alice"], ["Bob"], ["Carol"]]})

    response = _insights(file_id, "Data")

    assert response.status_code == 200
    assert response.json()["duplicate_row_count"] == 0


def test_detects_increasing_trend(tmp_path, monkeypatch):
    monkeypatch.setattr(get_settings(), "STORAGE_DIR", tmp_path)

    file_id = _upload_sheets({"Data": [["Value"], [1], [2], [3], [4], [5], [6]]})

    response = _insights(file_id, "Data")

    assert response.status_code == 200
    trend = next(t for t in response.json()["trends"] if t["column"] == "Value")
    assert trend["direction"] == "increasing"
    assert trend["strength"] > 0.9


def test_detects_decreasing_trend(tmp_path, monkeypatch):
    monkeypatch.setattr(get_settings(), "STORAGE_DIR", tmp_path)

    file_id = _upload_sheets({"Data": [["Value"], [6], [5], [4], [3], [2], [1]]})

    response = _insights(file_id, "Data")

    assert response.status_code == 200
    trend = next(t for t in response.json()["trends"] if t["column"] == "Value")
    assert trend["direction"] == "decreasing"
    assert trend["strength"] < -0.9


def test_no_trend_for_random_looking_data(tmp_path, monkeypatch):
    monkeypatch.setattr(get_settings(), "STORAGE_DIR", tmp_path)

    file_id = _upload_sheets({"Data": [["Value"], [5], [1], [9], [2], [8], [3]]})

    response = _insights(file_id, "Data")

    assert response.status_code == 200
    assert [t for t in response.json()["trends"] if t["column"] == "Value"] == []


def test_detects_correlation(tmp_path, monkeypatch):
    monkeypatch.setattr(get_settings(), "STORAGE_DIR", tmp_path)

    file_id = _upload_sheets(
        {"Data": [["A", "B"], [1, 10], [2, 20], [3, 30], [4, 40], [5, 50]]}
    )

    response = _insights(file_id, "Data")

    assert response.status_code == 200
    correlation = next(
        c
        for c in response.json()["correlations"]
        if {c["column_a"], c["column_b"]} == {"A", "B"}
    )
    assert correlation["correlation"] > 0.99


def test_no_correlation_for_unrelated_columns(tmp_path, monkeypatch):
    monkeypatch.setattr(get_settings(), "STORAGE_DIR", tmp_path)

    file_id = _upload_sheets(
        {"Data": [["A", "B"], [1, 5], [2, 1], [3, 9], [4, 2], [5, 8]]}
    )

    response = _insights(file_id, "Data")

    assert response.status_code == 200
    assert response.json()["correlations"] == []


def test_defaults_to_first_sheet(tmp_path, monkeypatch):
    monkeypatch.setattr(get_settings(), "STORAGE_DIR", tmp_path)

    file_id = _upload_sheets({"Sheet1": [["A"], [1], [2]], "Sheet2": [["B"], [3], [4]]})

    response = _insights(file_id)

    assert response.status_code == 200
    assert response.json()["sheet_name"] == "Sheet1"


def test_invalid_sheet_name_returns_400(tmp_path, monkeypatch):
    monkeypatch.setattr(get_settings(), "STORAGE_DIR", tmp_path)

    file_id = _upload_sheets({"Data": [["A"], [1]]})

    response = _insights(file_id, "DoesNotExist")

    assert response.status_code == 400


def test_missing_file_returns_404(tmp_path, monkeypatch):
    monkeypatch.setattr(get_settings(), "STORAGE_DIR", tmp_path)

    response = _insights("does-not-exist")

    assert response.status_code == 404


def test_too_few_values_does_not_crash(tmp_path, monkeypatch):
    monkeypatch.setattr(get_settings(), "STORAGE_DIR", tmp_path)

    file_id = _upload_sheets({"Data": [["Value"], [1], [2]]})

    response = _insights(file_id, "Data")

    assert response.status_code == 200
    body = response.json()
    assert body["outliers"] == []
    assert body["trends"] == []
    assert body["correlations"] == []
