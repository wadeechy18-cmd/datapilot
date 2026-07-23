"""
Local filesystem storage.

Deliberately narrow: save bytes, get a path back. This is the only place
that knows *where* files live on disk. When cloud storage replaces this in
a later milestone, only this module changes — callers keep using
save_file()/get_path().
"""

import uuid
from pathlib import Path

from app.core.config import get_settings


def _ensure_storage_dir() -> Path:
    settings = get_settings()
    settings.STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    return settings.STORAGE_DIR


def save_file(content: bytes, original_filename: str) -> tuple[str, Path]:
    """
    Save file content to the storage directory under a generated file_id.

    Returns (file_id, stored_path). Files are stored under a generated id
    rather than the original filename to avoid path-traversal/collision
    issues; the caller is responsible for returning the original filename
    to the client (there's no database yet to persist that mapping).
    """
    storage_dir = _ensure_storage_dir()
    file_id = uuid.uuid4().hex
    suffix = Path(original_filename).suffix.lower()
    stored_path = storage_dir / f"{file_id}{suffix}"
    stored_path.write_bytes(content)
    return file_id, stored_path


def get_path(file_id: str, suffix: str = ".xlsx") -> Path:
    """Resolve a file_id back to its path on disk."""
    normalized_suffix = suffix.lower()
    return get_settings().STORAGE_DIR / f"{file_id}{normalized_suffix}"
