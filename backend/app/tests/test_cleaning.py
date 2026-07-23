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


def _clean(file_id: str, request: dict, commit: bool = False):
    url = f"/api/v1/workbook/{file_id}/clean"
    if commit:
        url += "?commit=true"
    return client.post(url, json=request)


def test_clean_trim_whitespace_and_drop_duplicates_preview_only(tmp_path, monkeypatch):
    monkeypatch.setattr(get_settings(), "STORAGE_DIR", tmp_path)

    file_id = _upload_sheets(
        {"Data": [["Name", "Age"], [" Alice ", 30], ["Bob", 25], ["Bob", 25]]}
    )

    response = _clean(file_id, {"trim_whitespace": True, "drop_duplicate_rows": True})

    assert response.status_code == 200
    body = response.json()
    assert body["new_file_id"] is None

    sheet = next(s for s in body["sheets"] if s["name"] == "Data")
    assert sheet["original_row_count"] == 3
    assert sheet["cleaned_row_count"] == 2
    assert sheet["rows_removed"] == 1
    assert sheet["cells_trimmed"] == 1
    assert sheet["preview_rows"] == [["Alice", 30], ["Bob", 25]]

    # Preview-only: the stored file must be untouched.
    original = client.get(f"/api/v1/workbook/{file_id}")
    original_sheet = next(s for s in original.json()["sheets"] if s["name"] == "Data")
    assert original_sheet["preview_rows"] == [[" Alice ", 30], ["Bob", 25], ["Bob", 25]]


def test_clean_drop_empty_rows_and_columns(tmp_path, monkeypatch):
    monkeypatch.setattr(get_settings(), "STORAGE_DIR", tmp_path)

    file_id = _upload_sheets(
        {"Data": [["A", "B", "C"], [1, None, None], [None, None, None], [2, None, None]]}
    )

    response = _clean(file_id, {"drop_empty_columns": True, "drop_empty_rows": True})

    assert response.status_code == 200
    sheet = next(s for s in response.json()["sheets"] if s["name"] == "Data")
    assert sheet["headers"] == ["A"]
    assert sheet["columns_removed"] == 2
    assert sheet["cleaned_row_count"] == 2
    assert sheet["rows_removed"] == 1
    assert sheet["preview_rows"] == [[1], [2]]


def test_clean_drop_rows_with_nulls(tmp_path, monkeypatch):
    monkeypatch.setattr(get_settings(), "STORAGE_DIR", tmp_path)

    file_id = _upload_sheets({"Data": [["A", "B"], [1, 2], [3, None], [5, 6]]})

    response = _clean(file_id, {"drop_rows_with_nulls": True})

    assert response.status_code == 200
    sheet = next(s for s in response.json()["sheets"] if s["name"] == "Data")
    assert sheet["cleaned_row_count"] == 2
    assert sheet["rows_removed"] == 1
    assert sheet["preview_rows"] == [[1, 2], [5, 6]]


def test_clean_fill_nulls_zero_and_mean(tmp_path, monkeypatch):
    monkeypatch.setattr(get_settings(), "STORAGE_DIR", tmp_path)

    file_id = _upload_sheets({"Data": [["A"], [1], [None], [3]]})

    zero_response = _clean(file_id, {"fill_nulls": {"strategy": "zero"}})
    assert zero_response.status_code == 200
    zero_sheet = next(s for s in zero_response.json()["sheets"] if s["name"] == "Data")
    assert zero_sheet["nulls_filled"] == 1
    assert zero_sheet["preview_rows"] == [[1], [0], [3]]

    mean_response = _clean(file_id, {"fill_nulls": {"strategy": "mean"}})
    assert mean_response.status_code == 200
    mean_sheet = next(s for s in mean_response.json()["sheets"] if s["name"] == "Data")
    assert mean_sheet["nulls_filled"] == 1
    assert mean_sheet["preview_rows"] == [[1], [2], [3]]


def test_clean_fill_nulls_mode(tmp_path, monkeypatch):
    monkeypatch.setattr(get_settings(), "STORAGE_DIR", tmp_path)

    file_id = _upload_sheets({"Data": [["Category"], ["a"], ["a"], [None], ["b"]]})

    response = _clean(file_id, {"fill_nulls": {"strategy": "mode"}})

    assert response.status_code == 200
    sheet = next(s for s in response.json()["sheets"] if s["name"] == "Data")
    assert sheet["nulls_filled"] == 1
    assert sheet["preview_rows"] == [["a"], ["a"], ["a"], ["b"]]


def test_clean_fill_nulls_placeholder(tmp_path, monkeypatch):
    monkeypatch.setattr(get_settings(), "STORAGE_DIR", tmp_path)

    file_id = _upload_sheets({"Data": [["Notes"], ["ok"], [None]]})

    response = _clean(file_id, {"fill_nulls": {"strategy": "placeholder", "placeholder": "N/A"}})

    assert response.status_code == 200
    sheet = next(s for s in response.json()["sheets"] if s["name"] == "Data")
    assert sheet["nulls_filled"] == 1
    assert sheet["preview_rows"] == [["ok"], ["N/A"]]


def test_clean_rejects_conflicting_null_handling(tmp_path, monkeypatch):
    monkeypatch.setattr(get_settings(), "STORAGE_DIR", tmp_path)

    file_id = _upload_sheets({"Data": [["A"], [1], [None]]})

    response = _clean(
        file_id, {"drop_rows_with_nulls": True, "fill_nulls": {"strategy": "zero"}}
    )

    assert response.status_code == 422


def test_clean_placeholder_strategy_requires_placeholder_value(tmp_path, monkeypatch):
    monkeypatch.setattr(get_settings(), "STORAGE_DIR", tmp_path)

    file_id = _upload_sheets({"Data": [["A"], [1], [None]]})

    response = _clean(file_id, {"fill_nulls": {"strategy": "placeholder"}})

    assert response.status_code == 422


def test_clean_targets_single_sheet_others_untouched(tmp_path, monkeypatch):
    monkeypatch.setattr(get_settings(), "STORAGE_DIR", tmp_path)

    file_id = _upload_sheets(
        {
            "Sheet1": [["Name"], [" Alice "]],
            "Sheet2": [["Name"], [" Bob "]],
        }
    )

    response = _clean(file_id, {"sheet_name": "Sheet1", "trim_whitespace": True})

    assert response.status_code == 200
    body = response.json()
    sheet1 = next(s for s in body["sheets"] if s["name"] == "Sheet1")
    sheet2 = next(s for s in body["sheets"] if s["name"] == "Sheet2")

    assert sheet1["cells_trimmed"] == 1
    assert sheet1["preview_rows"] == [["Alice"]]
    assert sheet2["cells_trimmed"] == 0
    assert sheet2["preview_rows"] == [[" Bob "]]


def test_clean_invalid_sheet_name_returns_400(tmp_path, monkeypatch):
    monkeypatch.setattr(get_settings(), "STORAGE_DIR", tmp_path)

    file_id = _upload_sheets({"Sheet1": [["Name"], ["Alice"]]})

    response = _clean(file_id, {"sheet_name": "DoesNotExist"})

    assert response.status_code == 400


def test_clean_commit_writes_new_file_and_leaves_original_untouched(tmp_path, monkeypatch):
    monkeypatch.setattr(get_settings(), "STORAGE_DIR", tmp_path)

    file_id = _upload_sheets({"Data": [["Name"], [" Alice "]]})

    response = _clean(file_id, {"trim_whitespace": True}, commit=True)

    assert response.status_code == 200
    body = response.json()
    new_file_id = body["new_file_id"]
    assert new_file_id is not None
    assert new_file_id != file_id

    cleaned = client.get(f"/api/v1/workbook/{new_file_id}")
    assert cleaned.status_code == 200
    cleaned_sheet = next(s for s in cleaned.json()["sheets"] if s["name"] == "Data")
    assert cleaned_sheet["preview_rows"] == [["Alice"]]

    original = client.get(f"/api/v1/workbook/{file_id}")
    original_sheet = next(s for s in original.json()["sheets"] if s["name"] == "Data")
    assert original_sheet["preview_rows"] == [[" Alice "]]


def test_clean_missing_file_returns_404(tmp_path, monkeypatch):
    monkeypatch.setattr(get_settings(), "STORAGE_DIR", tmp_path)

    response = _clean("does-not-exist", {"trim_whitespace": True})

    assert response.status_code == 404
