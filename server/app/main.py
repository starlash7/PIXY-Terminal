from __future__ import annotations

import importlib
import json
import logging
import os
import re
import shutil
import subprocess
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional
from uuid import uuid4

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

logger = logging.getLogger("pixy.server")
ANSI_RE = re.compile(r"\x1b\[[0-?]*[ -/]*[@-~]")


class ApiError(Exception):
    def __init__(
        self,
        *,
        code: str,
        message: str,
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        details: Optional[dict[str, Any]] = None,
    ) -> None:
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        super().__init__(message)


class InvalidMessageError(ApiError):
    def __init__(self) -> None:
        super().__init__(
            code="invalid_message",
            message="Message cannot be empty.",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        )


class StorageReadError(ApiError):
    def __init__(self, *, target: str, path: Path, error: Exception) -> None:
        super().__init__(
            code="storage_read_failed",
            message=f"Failed to read {target}.",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            details={"path": str(path), "reason": str(error)},
        )


class SessionNotFoundError(ApiError):
    def __init__(self, *, session_id: str) -> None:
        super().__init__(
            code="session_not_found",
            message=f"Session `{session_id}` was not found.",
            status_code=status.HTTP_404_NOT_FOUND,
            details={"session_id": session_id},
        )


class HermesExecutionError(ApiError):
    def __init__(
        self,
        error: Exception,
        *,
        details: Optional[dict[str, Any]] = None,
    ) -> None:
        payload = {"reason": str(error)}
        if details:
            payload.update(details)
        super().__init__(
            code="hermes_execution_failed",
            message="Hermes Agent failed to process the message.",
            status_code=status.HTTP_502_BAD_GATEWAY,
            details=payload,
        )


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=12000)
    session_id: Optional[str] = Field(default=None, max_length=120)


class ChatResponse(BaseModel):
    reply: str
    session_id: str
    mode: str
    request_id: str
    warnings: list[str] = Field(default_factory=list)
    generated_at: str
    skill_invocation: Optional["SkillInvocation"] = None


class SkillInvocation(BaseModel):
    id: str
    label: str
    detail: str


class SkillCard(BaseModel):
    id: str
    title: str
    path: str
    summary: str
    last_updated: str


class SkillsResponse(BaseModel):
    skills: list[SkillCard]
    source: str


class MemoryResponse(BaseModel):
    content: str
    path: Optional[str]
    warnings: list[str] = Field(default_factory=list)


class SessionCard(BaseModel):
    id: str
    title: str
    path: str
    last_updated: str
    message_count: int
    preview: str


class SessionMessage(BaseModel):
    id: str
    role: str
    content: str
    created_at: str


class SessionDetailResponse(SessionCard):
    messages: list[SessionMessage]


class SessionsResponse(BaseModel):
    sessions: list[SessionCard]
    source: str


class HealthResponse(BaseModel):
    status: str
    hermes_available: bool
    runtime_mode: str
    python_api_available: bool
    cli_available: bool
    hermes_home: str
    hermes_home_exists: bool
    memory_path: Optional[str]
    issues: list[str] = Field(default_factory=list)


@dataclass(frozen=True)
class HermesPaths:
    home: Path
    skills_dir: Path
    sessions_dir: Path
    skills_index: Path
    memory_candidates: tuple[Path, ...]


PIXY_MEMORY_SENTINEL_START = "<!-- PIXY_RECENT_INTERACTIONS:START -->"
PIXY_MEMORY_SENTINEL_END = "<!-- PIXY_RECENT_INTERACTIONS:END -->"
PIXY_MEMORY_MAX_CONTEXT_CHARS = 4000
PIXY_MEMORY_MAX_RECENT_ENTRIES = 8


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def request_id_from(request: Optional[Request]) -> str:
    if request is None:
        return uuid4().hex[:12]
    request_id = getattr(request.state, "request_id", None)
    return request_id if isinstance(request_id, str) and request_id else uuid4().hex[:12]


def resolve_paths() -> HermesPaths:
    home = Path(
        os.getenv("PIXY_HERMES_HOME")
        or os.getenv("HERMES_HOME")
        or Path.home() / ".hermes"
    ).expanduser()
    return HermesPaths(
        home=home,
        skills_dir=home / "skills",
        sessions_dir=home / "sessions",
        skills_index=home / "skills" / "index.json",
        memory_candidates=(home / "memories" / "MEMORY.md", home / "MEMORY.md"),
    )


def resolve_memory_path(paths: HermesPaths) -> Optional[Path]:
    for candidate in paths.memory_candidates:
        if candidate.exists():
            return candidate
    return None


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


def strip_pixy_recent_section(content: str) -> str:
    section_pattern = re.compile(
        rf"(?:\n*## PIXY Recent Interactions\s*)+\n*{re.escape(PIXY_MEMORY_SENTINEL_START)}\n.*?\n{re.escape(PIXY_MEMORY_SENTINEL_END)}\s*",
        flags=re.DOTALL,
    )
    cleaned = section_pattern.sub("\n", content)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()


def extract_cli_reply(cleaned_output: str) -> str:
    response_match = re.findall(
        r"╭─ ⚕ Hermes .*?╮\n(.*?)\n╰──────────────────────────────────────────────────────────────────────────────╯",
        cleaned_output,
        flags=re.DOTALL,
    )
    if response_match:
        return response_match[-1].strip()

    prefix = cleaned_output.split("Resume this session with:", maxsplit=1)[0]
    banner_match = re.search(r"\n\s*─\s+⚕ Hermes .*?\n", prefix, flags=re.DOTALL)
    if banner_match:
        trailing = prefix[banner_match.end() :]
        lines: list[str] = []
        for raw_line in trailing.splitlines():
            stripped = raw_line.strip()
            if not stripped:
                continue
            if stripped and all(char == "─" for char in stripped):
                break
            lines.append(stripped)
        if lines:
            return "\n".join(lines).strip()

    after_query = cleaned_output.split("Query:", maxsplit=1)[-1]
    return after_query.split("Resume this session with:", maxsplit=1)[0].strip()


class HermesRuntime:
    def __init__(self) -> None:
        self._python_error: Optional[str] = None
        self._agent_class = self._load_agent_class()
        self._cli_path = self._discover_cli_path()

    def _discover_cli_path(self) -> Optional[str]:
        env_command = os.getenv("PIXY_HERMES_COMMAND")
        candidates = []
        if env_command:
            candidates.append(Path(env_command).expanduser())
        which_path = shutil.which("hermes")
        if which_path:
            candidates.append(Path(which_path))
        candidates.extend(
            [
                Path.home() / ".local" / "bin" / "hermes",
                Path.home() / ".hermes" / "hermes-agent" / "hermes",
            ]
        )

        seen: set[str] = set()
        for candidate in candidates:
            normalized = str(candidate)
            if normalized in seen:
                continue
            seen.add(normalized)
            if candidate.is_file() and os.access(candidate, os.X_OK):
                return normalized
        return None

    def _load_agent_class(self) -> Optional[type[Any]]:
        candidates = (("run_agent", "AIAgent"), ("hermes.agent", "AIAgent"))
        for module_name, attr_name in candidates:
            try:
                module = importlib.import_module(module_name)
            except ModuleNotFoundError as error:
                self._python_error = str(error)
                continue
            except Exception as error:
                self._python_error = str(error)
                continue
            agent_class = getattr(module, attr_name, None)
            if agent_class is not None:
                return agent_class
        return None

    @property
    def python_api_available(self) -> bool:
        return self._agent_class is not None

    @property
    def cli_available(self) -> bool:
        if self._cli_path is None:
            self._cli_path = self._discover_cli_path()
        return self._cli_path is not None

    @property
    def available(self) -> bool:
        return self.python_api_available or self.cli_available

    @property
    def mode(self) -> str:
        if self.python_api_available:
            return "python_api"
        if self.cli_available:
            return "cli"
        return "simulator"

    def issues(self, paths: HermesPaths) -> list[str]:
        issues: list[str] = []
        if self._python_error:
            issues.append(f"Python API import failed: {self._python_error}")
        if self.cli_available and not self.python_api_available:
            issues.append("Hermes is currently running through CLI fallback, not the Python API.")
        if not paths.home.exists():
            issues.append("Hermes home directory does not exist yet.")
        elif not (paths.home / ".env").exists():
            issues.append("~/.hermes/.env is missing; Hermes is relying on external auth or defaults.")
        return issues

    def _run_cli(
        self,
        message: str,
        session_id: Optional[str],
        *,
        request_id: str,
    ) -> ChatResponse:
        if not self._cli_path:
            raise HermesExecutionError(RuntimeError("Hermes CLI is not available."))

        command = [self._cli_path, "chat"]
        if session_id:
            command.extend(["--resume", session_id])
        command.extend(["-q", message])

        try:
            completed = subprocess.run(
                command,
                capture_output=True,
                text=True,
                timeout=int(os.getenv("PIXY_HERMES_TIMEOUT", "300")),
                check=False,
            )
        except Exception as error:
            raise HermesExecutionError(
                error,
                details={"command": command},
            ) from error

        combined_output = "\n".join(
            part for part in (completed.stdout, completed.stderr) if part
        )
        if completed.returncode != 0:
            error_details = {
                "command": command,
                "exit_code": completed.returncode,
            }
            if completed.stdout.strip():
                error_details["stdout_preview"] = completed.stdout.strip()[:400]
            if completed.stderr.strip():
                error_details["stderr_preview"] = completed.stderr.strip()[:400]
            raise HermesExecutionError(
                RuntimeError(combined_output.strip() or f"Hermes CLI exited with {completed.returncode}."),
                details=error_details,
            )

        cleaned_output = ANSI_RE.sub("", combined_output).replace("\r", "\n")
        cleaned_output = re.sub(r"\n{3,}", "\n\n", cleaned_output)
        reply = extract_cli_reply(cleaned_output)
        if not reply:
            reply = "Hermes CLI completed without returning visible output."

        session_match = re.search(r"hermes --resume ([^\s]+)", cleaned_output)
        actual_session_id = session_match.group(1) if session_match else (session_id or uuid4().hex[:12])

        return ChatResponse(
            reply=reply,
            session_id=actual_session_id,
            mode="cli",
            request_id=request_id,
            warnings=["Hermes is running through CLI fallback instead of the Python API."],
            generated_at=now_iso(),
        )

    def chat(
        self,
        message: str,
        session_id: Optional[str],
        *,
        request_id: str,
    ) -> ChatResponse:
        request_session_id = session_id or uuid4().hex[:12]

        if self.python_api_available:
            try:
                agent = self._agent_class(session_id=request_session_id, quiet_mode=True)
                reply = agent.chat(message)
            except Exception as error:
                raise HermesExecutionError(error) from error

            response_text = reply.strip() if isinstance(reply, str) else ""
            if not response_text:
                response_text = "Hermes completed without returning visible output."

            return ChatResponse(
                reply=response_text,
                session_id=getattr(agent, "session_id", request_session_id),
                mode="python_api",
                request_id=request_id,
                generated_at=now_iso(),
            )

        if self.cli_available:
            return self._run_cli(message, session_id, request_id=request_id)

        if not self.available:
            return ChatResponse(
                reply=(
                    "Hermes Agent is not installed, so PIXY is running in simulator mode.\n\n"
                    f"Prompt: {message}\n\n"
                    "Install `hermes-agent`, configure your model provider, and restart the server "
                    "to switch this endpoint to live agent responses."
                ),
                session_id=request_session_id,
                mode="simulator",
                request_id=request_id,
                warnings=["Hermes Agent import failed. Returning a simulator response."],
                generated_at=now_iso(),
            )
        raise HermesExecutionError(RuntimeError("Hermes runtime resolution failed."))


runtime = HermesRuntime()


def list_skills(paths: HermesPaths) -> SkillsResponse:
    if not paths.skills_dir.exists():
        return SkillsResponse(skills=[], source=str(paths.skills_dir))

    index_data = read_json(paths.skills_index) or {}
    entries = []
    for path in sorted(paths.skills_dir.glob("*.md"), key=lambda item: item.stat().st_mtime, reverse=True):
        meta = index_data.get(path.stem) if isinstance(index_data, dict) else None
        title = (
            meta.get("name")
            if isinstance(meta, dict) and meta.get("name")
            else path.stem.replace("-", " ").replace("_", " ").title()
        )
        entries.append(
            SkillCard(
                id=path.stem,
                title=title,
                path=str(path),
                summary=extract_summary(path),
                last_updated=file_timestamp(path),
            )
        )

    return SkillsResponse(skills=entries, source=str(paths.skills_dir))


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


def wrap_message_with_memory(message: str, paths: HermesPaths) -> str:
    memory_block = memory_context_block(paths)
    if not memory_block:
        return message
    return (
        "Persistent memory is mounted for this user. Use it only when relevant, "
        "and do not restate it unless it matters.\n\n"
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


def unwrap_memory_wrapped_message(message: Any) -> str:
    if not isinstance(message, str):
        return ""
    marker = "Current user message:\n"
    if marker in message:
        return message.split(marker, maxsplit=1)[-1].strip()
    return message.strip()


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


def session_path(paths: HermesPaths, session_id: str) -> Path:
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


def parse_installed_skills(output: str) -> list[dict[str, str]]:
    skills: list[dict[str, str]] = []
    for raw_line in output.splitlines():
        line = ANSI_RE.sub("", raw_line).rstrip()
        if not line.startswith("│") or line.count("│") < 5:
            continue
        cells = [cell.strip() for cell in line.strip("│").split("│")]
        if len(cells) != 4:
            continue
        name, category, source, trust = cells
        if name in {"Name", ""}:
            continue
        skills.append(
            {
                "name": name,
                "category": category or "general",
                "source": source or "unknown",
                "trust": trust or "unknown",
            }
        )
    return skills


def handle_skill_command(
    runtime: HermesRuntime,
    paths: HermesPaths,
    *,
    message: str,
    session_id: Optional[str],
    request_id: str,
) -> Optional[ChatResponse]:
    normalized = message.strip()
    list_matches = re.match(r"^/(?:skill|skills)\s+list(?:\s+(.*))?$", normalized, flags=re.IGNORECASE)
    inspect_matches = re.match(r"^/(?:skill|skills)\s+inspect\s+([\w.-]+)$", normalized, flags=re.IGNORECASE)
    if not list_matches and not inspect_matches:
        return None
    if not runtime.cli_available or not runtime._cli_path:
        raise HermesExecutionError(RuntimeError("Hermes CLI is not available for skill commands."))

    command: list[str]
    query = ""
    if list_matches:
        query = (list_matches.group(1) or "").strip().lower()
        command = [runtime._cli_path, "skills", "list"]
        invocation = SkillInvocation(
            id="skills.list",
            label="skills.list",
            detail="listing installed skills",
        )
        fallback_error = "Hermes skills list failed."
    else:
        skill_name = inspect_matches.group(1).strip()
        query = skill_name.lower()
        command = [runtime._cli_path, "skills", "inspect", skill_name]
        invocation = SkillInvocation(
            id="skills.inspect",
            label="skills.inspect",
            detail=skill_name,
        )
        fallback_error = f"Hermes skills inspect failed for {skill_name}."

    try:
        completed = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=int(os.getenv("PIXY_HERMES_TIMEOUT", "300")),
            check=False,
        )
    except Exception as error:
        raise HermesExecutionError(error, details={"command": command}) from error

    if completed.returncode != 0:
        raise HermesExecutionError(
            RuntimeError(completed.stderr.strip() or completed.stdout.strip() or fallback_error),
            details={"command": command, "exit_code": completed.returncode},
        )

    if list_matches:
        installed = parse_installed_skills(completed.stdout)
        filtered = [
            skill
            for skill in installed
            if not query
            or query in skill["name"].lower()
            or query in skill["category"].lower()
            or query in skill["source"].lower()
        ]
        visible = filtered[:12]
        if visible:
            bullets = "\n".join(
                f"- `{skill['name']}` · {skill['category']} · {skill['source']} / {skill['trust']}"
                for skill in visible
            )
            reply = (
                f"Installed skill matches: {len(filtered)}"
                + (f" for `{query}`" if query else "")
                + "\n\n"
                + bullets
            )
        else:
            reply = f"No installed skills matched `{query}`."
        invocation.detail = f"{len(filtered)} match(es)" + (f" for {query}" if query else "")
    else:
        cleaned = ANSI_RE.sub("", "\n".join(part for part in (completed.stdout, completed.stderr) if part)).strip()
        reply = f"```text\n{cleaned[:5000]}\n```"

    effective_session_id = session_id or latest_session_id(paths) or "new-thread"
    return ChatResponse(
        reply=reply,
        session_id=effective_session_id,
        mode="cli",
        request_id=request_id,
        generated_at=now_iso(),
        skill_invocation=invocation,
    )


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


def create_app() -> FastAPI:
    app = FastAPI(title="PIXY TERMINAL API", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://127.0.0.1:3000",
            "http://localhost:3000",
            os.getenv("PIXY_FRONTEND_ORIGIN", "http://localhost:3000"),
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def attach_request_id(request: Request, call_next):
        request_id = uuid4().hex[:12]
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["x-pixy-request-id"] = request_id
        return response

    @app.exception_handler(ApiError)
    async def api_error_handler(request: Request, error: ApiError) -> JSONResponse:
        request_id = request_id_from(request)
        return JSONResponse(
            status_code=error.status_code,
            content={
                "error": {
                    "code": error.code,
                    "message": error.message,
                    "request_id": request_id,
                    "details": error.details,
                }
            },
            headers={"x-pixy-request-id": request_id},
        )

    @app.exception_handler(Exception)
    async def unhandled_error_handler(request: Request, error: Exception) -> JSONResponse:
        request_id = request_id_from(request)
        logger.exception("Unhandled server error", extra={"request_id": request_id})
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": {
                    "code": "internal_server_error",
                    "message": "PIXY hit an unexpected server error.",
                    "request_id": request_id,
                    "details": {"reason": str(error)},
                }
            },
            headers={"x-pixy-request-id": request_id},
        )

    @app.get("/health", response_model=HealthResponse)
    async def health() -> HealthResponse:
        paths = resolve_paths()
        memory_path = resolve_memory_path(paths)
        return HealthResponse(
            status="ok",
            hermes_available=runtime.available,
            runtime_mode=runtime.mode,
            python_api_available=runtime.python_api_available,
            cli_available=runtime.cli_available,
            hermes_home=str(paths.home),
            hermes_home_exists=paths.home.exists(),
            memory_path=str(memory_path) if memory_path else None,
            issues=runtime.issues(paths),
        )

    @app.post("/chat", response_model=ChatResponse)
    async def chat(payload: ChatRequest, request: Request) -> ChatResponse:
        if not payload.message.strip():
            raise InvalidMessageError()
        paths = resolve_paths()
        raw_message = payload.message.strip()
        skill_response = handle_skill_command(
            runtime,
            paths,
            message=raw_message,
            session_id=payload.session_id,
            request_id=request_id_from(request),
        )
        if skill_response is not None:
            write_memory_snapshot(
                paths,
                session_id=skill_response.session_id,
                user_message=raw_message,
                reply=skill_response.reply,
            )
            return skill_response
        resume_session_id = payload.session_id if session_exists(paths, payload.session_id) else None
        response = runtime.chat(
            wrap_message_with_memory(raw_message, paths),
            resume_session_id,
            request_id=request_id_from(request),
        )
        if payload.session_id and resume_session_id is None:
            response.warnings.append(
                f"Requested session `{payload.session_id}` was not found, so Hermes started a new session."
            )
        write_memory_snapshot(
            paths,
            session_id=response.session_id,
            user_message=raw_message,
            reply=response.reply,
        )
        return response

    @app.get("/skills", response_model=SkillsResponse)
    async def skills() -> SkillsResponse:
        return list_skills(resolve_paths())

    @app.get("/memory", response_model=MemoryResponse)
    async def memory() -> MemoryResponse:
        return read_memory(resolve_paths())

    @app.get("/sessions", response_model=SessionsResponse)
    async def sessions() -> SessionsResponse:
        return list_sessions(resolve_paths())

    @app.get("/sessions/{session_id}", response_model=SessionDetailResponse)
    async def session_detail(session_id: str) -> SessionDetailResponse:
        return get_session_detail(resolve_paths(), session_id)

    return app


app = create_app()
