from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=12000)
    session_id: Optional[str] = Field(default=None, max_length=120)


class SkillInvocation(BaseModel):
    id: str
    label: str
    detail: str


class ChatResponse(BaseModel):
    reply: str
    session_id: str
    mode: str
    request_id: str
    warnings: list[str] = Field(default_factory=list)
    generated_at: str
    skill_invocation: Optional[SkillInvocation] = None
    memory_evidence: list[str] = Field(default_factory=list)


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
