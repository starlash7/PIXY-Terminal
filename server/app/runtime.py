from __future__ import annotations

import importlib
import os
import re
import shutil
import subprocess
from pathlib import Path
from typing import Any, Optional
from uuid import uuid4

from app.errors import HermesExecutionError
from app.paths import HermesPaths
from app.schemas import ChatResponse
from app.time_utils import now_iso


ANSI_RE = re.compile(r"\x1b\[[0-?]*[ -/]*[@-~]")


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


def extract_cli_session_id(cleaned_output: str, fallback_session_id: Optional[str]) -> str:
    session_match = re.search(r"hermes --resume ([^\s]+)", cleaned_output)
    if session_match:
        return session_match.group(1)
    return fallback_session_id or uuid4().hex[:12]


class HermesRuntime:
    def __init__(self) -> None:
        self._python_error: Optional[str] = None
        self._agent_class = self._load_agent_class()
        self._cli_path = self._discover_cli_path()

    @property
    def cli_path(self) -> Optional[str]:
        if self._cli_path is None:
            self._cli_path = self._discover_cli_path()
        return self._cli_path

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
        return self.cli_path is not None

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
        if not self.cli_path:
            raise HermesExecutionError(RuntimeError("Hermes CLI is not available."))

        command = [self.cli_path, "chat"]
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
            raise HermesExecutionError(error, details={"command": command}) from error

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
        actual_session_id = extract_cli_session_id(cleaned_output, session_id)

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
