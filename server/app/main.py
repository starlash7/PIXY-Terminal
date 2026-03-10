from __future__ import annotations

import importlib
import json
import logging
import os
import re
import shutil
import subprocess
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
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
        details: dict[str, Any] | None = None,
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


class HermesExecutionError(ApiError):
    def __init__(self, error: Exception) -> None:
        super().__init__(
            code="hermes_execution_failed",
            message="Hermes Agent failed to process the message.",
            status_code=status.HTTP_502_BAD_GATEWAY,
            details={"reason": str(error)},
        )


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=12000)
    session_id: str | None = Field(default=None, max_length=120)


class ChatResponse(BaseModel):
    reply: str
    session_id: str
    mode: str
    warnings: list[str] = Field(default_factory=list)
    generated_at: str


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
    path: str | None
    warnings: list[str] = Field(default_factory=list)


class SessionCard(BaseModel):
    id: str
    title: str
    path: str
    last_updated: str
    message_count: int
    preview: str


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
    memory_path: str | None
    issues: list[str] = Field(default_factory=list)


@dataclass(frozen=True)
class HermesPaths:
    home: Path
    skills_dir: Path
    sessions_dir: Path
    skills_index: Path
    memory_candidates: tuple[Path, ...]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


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


def resolve_memory_path(paths: HermesPaths) -> Path | None:
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


class HermesRuntime:
    def __init__(self) -> None:
        self._python_error: str | None = None
        self._agent_class = self._load_agent_class()
        self._cli_path = shutil.which(os.getenv("PIXY_HERMES_COMMAND", "hermes"))

    def _load_agent_class(self) -> type[Any] | None:
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

    def _run_cli(self, message: str, session_id: str | None) -> ChatResponse:
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
            raise HermesExecutionError(error) from error

        combined_output = "\n".join(
            part for part in (completed.stdout, completed.stderr) if part
        )
        if completed.returncode != 0:
            raise HermesExecutionError(
                RuntimeError(combined_output.strip() or f"Hermes CLI exited with {completed.returncode}.")
            )

        cleaned_output = ANSI_RE.sub("", combined_output).replace("\r", "\n")
        cleaned_output = re.sub(r"\n{3,}", "\n\n", cleaned_output)

        response_match = re.findall(
            r"╭─ ⚕ Hermes .*?╮\n(.*?)\n╰──────────────────────────────────────────────────────────────────────────────╯",
            cleaned_output,
            flags=re.DOTALL,
        )
        reply = response_match[-1].strip() if response_match else ""
        if not reply:
            after_query = cleaned_output.split("Query:", maxsplit=1)[-1]
            reply = after_query.split("Resume this session with:", maxsplit=1)[0].strip()
        if not reply:
            reply = "Hermes CLI completed without returning visible output."

        session_match = re.search(r"hermes --resume ([^\s]+)", cleaned_output)
        actual_session_id = session_match.group(1) if session_match else (session_id or uuid4().hex[:12])

        return ChatResponse(
            reply=reply,
            session_id=actual_session_id,
            mode="hermes_cli",
            warnings=["Hermes is running through CLI fallback instead of the Python API."],
            generated_at=now_iso(),
        )

    def chat(self, message: str, session_id: str | None) -> ChatResponse:
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
                mode="hermes",
                generated_at=now_iso(),
            )

        if self.cli_available:
            return self._run_cli(message, session_id)

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


def session_title(entry: dict[str, Any]) -> str:
    messages = entry.get("messages") or []
    for message in messages:
        if message.get("role") == "user" and message.get("content"):
            return str(message["content"]).strip()[:80]
    return f"Session {entry.get('session_id', 'unknown')}"


def session_preview(entry: dict[str, Any]) -> str:
    messages = entry.get("messages") or []
    for message in reversed(messages):
        if message.get("role") == "assistant" and message.get("content"):
            return str(message["content"]).strip()[:180]
    return "No assistant response recorded yet."


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

    @app.exception_handler(ApiError)
    async def api_error_handler(_: Request, error: ApiError) -> JSONResponse:
        return JSONResponse(
            status_code=error.status_code,
            content={
                "error": {
                    "code": error.code,
                    "message": error.message,
                    "details": error.details,
                }
            },
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
    async def chat(payload: ChatRequest) -> ChatResponse:
        if not payload.message.strip():
            raise InvalidMessageError()
        return runtime.chat(payload.message.strip(), payload.session_id)

    @app.get("/skills", response_model=SkillsResponse)
    async def skills() -> SkillsResponse:
        return list_skills(resolve_paths())

    @app.get("/memory", response_model=MemoryResponse)
    async def memory() -> MemoryResponse:
        return read_memory(resolve_paths())

    @app.get("/sessions", response_model=SessionsResponse)
    async def sessions() -> SessionsResponse:
        return list_sessions(resolve_paths())

    return app


app = create_app()
