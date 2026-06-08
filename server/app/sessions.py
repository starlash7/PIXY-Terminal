from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from app.errors import SessionNotFoundError
from app.memory import unwrap_memory_wrapped_message
from app.paths import HermesPaths
from app.schemas import SessionCard, SessionDetailResponse, SessionMessage, SessionsResponse
from app.storage import file_timestamp, read_json


def session_title(entry: dict[str, Any]) -> str:
    messages = entry.get("messages") or []
    for message in messages:
        if message.get("role") == "user" and message.get("content"):
            return unwrap_memory_wrapped_message(message["content"])[:80]
    return f"Session {entry.get('session_id', 'unknown')}"


def session_preview(entry: dict[str, Any]) -> str:
    messages = entry.get("messages") or []
    for message in reversed(messages):
        if message.get("role") == "assistant" and message.get("content"):
            return str(message["content"]).strip()[:180]
    return "No assistant response recorded yet."


def session_exists(paths: HermesPaths, session_id: Optional[str]) -> bool:
    if not session_id:
        return False
    return (paths.sessions_dir / f"session_{session_id}.json").exists()


def session_path(paths: HermesPaths, session_id: str):
    path = paths.sessions_dir / f"session_{session_id}.json"
    if path.exists():
        return path
    raise SessionNotFoundError(session_id=session_id)


def latest_session_id(paths: HermesPaths) -> Optional[str]:
    if not paths.sessions_dir.exists():
        return None
    latest = next(
        iter(sorted(paths.sessions_dir.glob("session_*.json"), key=lambda item: item.stat().st_mtime, reverse=True)),
        None,
    )
    if latest is None:
        return None
    entry = read_json(latest)
    if isinstance(entry, dict) and entry.get("session_id"):
        return str(entry["session_id"])
    return latest.stem.replace("session_", "")


def parse_iso_datetime(value: Any) -> Optional[datetime]:
    if not isinstance(value, str) or not value.strip():
        return None
    normalized = value.strip().replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def list_session_messages(entry: dict[str, Any]) -> list[SessionMessage]:
    messages = entry.get("messages") or []
    if not isinstance(messages, list):
        return []

    start_dt = parse_iso_datetime(entry.get("session_start")) or datetime.now(timezone.utc)
    end_dt = parse_iso_datetime(entry.get("last_updated")) or start_dt
    span_seconds = max(0.0, (end_dt - start_dt).total_seconds())
    total = max(1, len(messages) - 1)

    session_messages: list[SessionMessage] = []
    for index, message in enumerate(messages):
        if not isinstance(message, dict):
            continue
        role = str(message.get("role") or "assistant").strip()
        content = str(message.get("content") or "").strip()
        if role == "user":
            content = unwrap_memory_wrapped_message(content)
        if role not in {"user", "assistant"} or not content:
            continue
        created_dt = start_dt + timedelta(seconds=(span_seconds * index / total))
        session_messages.append(
            SessionMessage(
                id=f"{entry.get('session_id', 'session')}-{index}",
                role=role,
                content=content,
                created_at=created_dt.isoformat(),
            )
        )
    return session_messages


def list_sessions(paths: HermesPaths) -> SessionsResponse:
    if not paths.sessions_dir.exists():
        return SessionsResponse(sessions=[], source=str(paths.sessions_dir))

    sessions: list[SessionCard] = []
    for path in sorted(paths.sessions_dir.glob("session_*.json"), key=lambda item: item.stat().st_mtime, reverse=True):
        entry = read_json(path)
        if not isinstance(entry, dict):
            continue
        sessions.append(
            SessionCard(
                id=str(entry.get("session_id") or path.stem.replace("session_", "")),
                title=session_title(entry),
                path=str(path),
                last_updated=str(entry.get("last_updated") or file_timestamp(path)),
                message_count=int(entry.get("message_count") or 0),
                preview=session_preview(entry),
            )
        )

    return SessionsResponse(sessions=sessions, source=str(paths.sessions_dir))


def get_session_detail(paths: HermesPaths, session_id: str) -> SessionDetailResponse:
    path = session_path(paths, session_id)
    entry = read_json(path)
    if not isinstance(entry, dict):
        raise SessionNotFoundError(session_id=session_id)
    return SessionDetailResponse(
        id=str(entry.get("session_id") or session_id),
        title=session_title(entry),
        path=str(path),
        last_updated=str(entry.get("last_updated") or file_timestamp(path)),
        message_count=int(entry.get("message_count") or len(entry.get("messages") or [])),
        preview=session_preview(entry),
        messages=list_session_messages(entry),
    )
