from __future__ import annotations

import re

from app.errors import StorageReadError
from app.paths import HermesPaths, resolve_memory_path
from app.schemas import MemoryResponse
from app.time_utils import now_iso


PIXY_MEMORY_SENTINEL_START = "<!-- PIXY_RECENT_INTERACTIONS:START -->"
PIXY_MEMORY_SENTINEL_END = "<!-- PIXY_RECENT_INTERACTIONS:END -->"
PIXY_MEMORY_MAX_CONTEXT_CHARS = 4000
PIXY_MEMORY_MAX_RECENT_ENTRIES = 8


def strip_pixy_recent_section(content: str) -> str:
    section_pattern = re.compile(
        rf"(?:\n*## PIXY Recent Interactions\s*)+\n*{re.escape(PIXY_MEMORY_SENTINEL_START)}\n.*?\n{re.escape(PIXY_MEMORY_SENTINEL_END)}\s*",
        flags=re.DOTALL,
    )
    cleaned = section_pattern.sub("\n", content)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()


def read_memory(paths: HermesPaths) -> MemoryResponse:
    memory_path = resolve_memory_path(paths)
    if memory_path is None:
        return MemoryResponse(
            content="No MEMORY.md file found yet.",
            path=None,
            warnings=["Checked ~/.hermes/memories/MEMORY.md and ~/.hermes/MEMORY.md."],
        )

    try:
        content = memory_path.read_text(encoding="utf-8")
    except OSError as error:
        raise StorageReadError(target="memory file", path=memory_path, error=error) from error

    return MemoryResponse(content=content, path=str(memory_path))


def read_memory_text(paths: HermesPaths) -> str:
    memory_path = resolve_memory_path(paths)
    if memory_path is None:
        return ""
    try:
        return memory_path.read_text(encoding="utf-8")
    except OSError as error:
        raise StorageReadError(target="memory file", path=memory_path, error=error) from error


def memory_context_block(paths: HermesPaths) -> str:
    content = read_memory_text(paths).strip()
    if not content:
        return ""
    content = strip_pixy_recent_section(content)
    return content[:PIXY_MEMORY_MAX_CONTEXT_CHARS]


def extract_memory_evidence(paths: HermesPaths) -> list[str]:
    evidence: list[str] = []
    for raw_line in memory_context_block(paths).splitlines():
        line = raw_line.strip()
        if not line.startswith("- "):
            continue
        normalized = line[2:].strip()
        if normalized and normalized not in evidence:
            evidence.append(normalized[:140])
    return evidence[:3]


def wrap_message_with_memory(message: str, paths: HermesPaths) -> str:
    memory_block = memory_context_block(paths)
    if not memory_block:
        return message
    return (
        "Persistent memory is mounted for this user. Use it only when relevant, "
        "and do not restate it unless it matters.\n"
        "Reply in the same language as the current user message by default. "
        "If the user writes in Korean, concise Korean is preferred.\n\n"
        f"{memory_block}\n\n"
        "Current user message:\n"
        f"{message}"
    )


def _recent_memory_entry(timestamp: str, session_id: str, user_message: str, reply: str) -> str:
    user_preview = " ".join(user_message.split())[:220]
    reply_preview = " ".join(reply.split())[:280]
    return (
        f"- {timestamp} · session `{session_id}`\n"
        f"  user: {user_preview}\n"
        f"  assistant: {reply_preview}"
    )


def write_memory_snapshot(paths: HermesPaths, *, session_id: str, user_message: str, reply: str) -> None:
    memory_path = resolve_memory_path(paths) or paths.home / "memories" / "MEMORY.md"
    memory_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        existing = memory_path.read_text(encoding="utf-8") if memory_path.exists() else "# MEMORY\n\n"
    except OSError as error:
        raise StorageReadError(target="memory file", path=memory_path, error=error) from error

    entry = _recent_memory_entry(now_iso(), session_id, user_message, reply)
    recent_entries: list[str] = [entry]
    pattern = re.compile(
        rf"{re.escape(PIXY_MEMORY_SENTINEL_START)}\n(.*?)\n{re.escape(PIXY_MEMORY_SENTINEL_END)}",
        flags=re.DOTALL,
    )
    match = pattern.search(existing)
    if match:
        block = match.group(1).strip()
        if block:
            raw_entries = [segment.strip() for segment in block.split("\n- ") if segment.strip()]
            for index, raw_entry in enumerate(raw_entries):
                normalized = raw_entry if index == 0 or raw_entry.startswith("- ") else f"- {raw_entry}"
                recent_entries.append(normalized)
        base = strip_pixy_recent_section(existing)
    else:
        base = strip_pixy_recent_section(existing)

    deduped: list[str] = []
    seen: set[str] = set()
    for item in recent_entries:
        if item in seen:
            continue
        seen.add(item)
        deduped.append(item)
    deduped = deduped[:PIXY_MEMORY_MAX_RECENT_ENTRIES]

    recent_body = "\n\n".join(deduped)
    recent_section = (
        "## PIXY Recent Interactions\n\n"
        f"{PIXY_MEMORY_SENTINEL_START}\n"
        f"{recent_body}\n"
        f"{PIXY_MEMORY_SENTINEL_END}"
    )
    base = base or "# MEMORY"
    payload = f"{base}\n\n{recent_section}\n"
    try:
        memory_path.write_text(payload, encoding="utf-8")
    except OSError as error:
        raise StorageReadError(target="memory file", path=memory_path, error=error) from error


def unwrap_memory_wrapped_message(message: object) -> str:
    if not isinstance(message, str):
        return ""
    marker = "Current user message:\n"
    if marker in message:
        return message.split(marker, maxsplit=1)[-1].strip()
    return message.strip()
