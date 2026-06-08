from __future__ import annotations

import os
import re
import subprocess
from typing import Optional

from app.errors import HermesExecutionError
from app.paths import HermesPaths
from app.runtime import ANSI_RE, HermesRuntime, extract_cli_reply, extract_cli_session_id
from app.schemas import ChatResponse, SkillCard, SkillInvocation, SkillsResponse
from app.sessions import latest_session_id, session_exists
from app.storage import extract_summary, file_timestamp, read_json
from app.time_utils import now_iso


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


def list_skills(runtime: HermesRuntime, paths: HermesPaths) -> SkillsResponse:
    if runtime.cli_available and runtime.cli_path:
        try:
            completed = subprocess.run(
                [runtime.cli_path, "skills", "list"],
                capture_output=True,
                text=True,
                timeout=int(os.getenv("PIXY_HERMES_TIMEOUT", "300")),
                check=False,
            )
        except Exception as error:
            raise HermesExecutionError(error, details={"command": [runtime.cli_path, "skills", "list"]}) from error

        if completed.returncode == 0:
            installed = parse_installed_skills(completed.stdout)
            cards = [
                SkillCard(
                    id=skill["name"],
                    title=skill["name"],
                    path=f"{skill['source']}::{skill['name']}",
                    summary=f"{skill['category']} · source {skill['source']} · trust {skill['trust']}",
                    last_updated=now_iso(),
                )
                for skill in installed
            ]
            return SkillsResponse(skills=cards, source="hermes-cli")

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
    run_matches = re.match(
        r"^/(?:skill|skills)\s+run\s+([\w.-]+)\s*::\s*(.+)$",
        normalized,
        flags=re.IGNORECASE | re.DOTALL,
    )
    if not list_matches and not inspect_matches and not run_matches:
        return None
    if not runtime.cli_available or not runtime.cli_path:
        raise HermesExecutionError(RuntimeError("Hermes CLI is not available for skill commands."))

    command: list[str]
    query = ""
    if list_matches:
        query = (list_matches.group(1) or "").strip().lower()
        command = [runtime.cli_path, "skills", "list"]
        invocation = SkillInvocation(
            id="skills.list",
            label="skills.list",
            detail="listing installed skills",
        )
        fallback_error = "Hermes skills list failed."
    elif inspect_matches:
        skill_name = inspect_matches.group(1).strip()
        query = skill_name.lower()
        command = [runtime.cli_path, "skills", "inspect", skill_name]
        invocation = SkillInvocation(
            id="skills.inspect",
            label="skills.inspect",
            detail=skill_name,
        )
        fallback_error = f"Hermes skills inspect failed for {skill_name}."
    else:
        skill_name = run_matches.group(1).strip()
        skill_prompt = run_matches.group(2).strip()
        resume_session_id = session_id if session_exists(paths, session_id) else None
        command = [runtime.cli_path, "chat"]
        if resume_session_id:
            command.extend(["--resume", resume_session_id])
        command.extend(["-s", skill_name, "-q", skill_prompt])
        invocation = SkillInvocation(
            id="skills.run",
            label="skills.run",
            detail=skill_name,
        )
        fallback_error = f"Hermes skills run failed for {skill_name}."

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
    elif inspect_matches:
        cleaned = ANSI_RE.sub("", "\n".join(part for part in (completed.stdout, completed.stderr) if part)).strip()
        reply = f"```text\n{cleaned[:5000]}\n```"
    else:
        cleaned_output = ANSI_RE.sub("", "\n".join(part for part in (completed.stdout, completed.stderr) if part))
        cleaned_output = cleaned_output.replace("\r", "\n")
        cleaned_output = re.sub(r"\n{3,}", "\n\n", cleaned_output)
        reply = extract_cli_reply(cleaned_output) or "Hermes skill run completed without visible output."

    effective_session_id = (
        extract_cli_session_id(cleaned_output, session_id)
        if run_matches
        else session_id or latest_session_id(paths) or "new-thread"
    )
    return ChatResponse(
        reply=reply,
        session_id=effective_session_id,
        mode="cli",
        request_id=request_id,
        generated_at=now_iso(),
        skill_invocation=invocation,
    )
