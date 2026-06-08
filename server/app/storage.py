from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.errors import StorageReadError


def read_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return None
    except json.JSONDecodeError as error:
        raise StorageReadError(target="JSON file", path=path, error=error) from error
    except OSError as error:
        raise StorageReadError(target="JSON file", path=path, error=error) from error


def file_timestamp(path: Path) -> str:
    return datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc).isoformat()


def extract_summary(path: Path) -> str:
    try:
        for raw_line in path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip().lstrip("#").strip()
            if line:
                return line[:220]
        return "No summary available yet."
    except OSError as error:
        raise StorageReadError(target="skill file", path=path, error=error) from error
