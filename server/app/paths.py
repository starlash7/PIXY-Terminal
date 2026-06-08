from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Optional


@dataclass(frozen=True)
class HermesPaths:
    home: Path
    skills_dir: Path
    sessions_dir: Path
    skills_index: Path
    memory_candidates: tuple[Path, ...]


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
