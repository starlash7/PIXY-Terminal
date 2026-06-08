from __future__ import annotations

import logging
import os
from uuid import uuid4

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.errors import ApiError, InvalidMessageError, request_id_from
from app.memory import (
    extract_memory_evidence,
    read_memory,
    wrap_message_with_memory,
    write_memory_snapshot,
)
from app.paths import resolve_memory_path, resolve_paths
from app.runtime import HermesRuntime
from app.schemas import (
    ChatRequest,
    ChatResponse,
    HealthResponse,
    MemoryResponse,
    SessionDetailResponse,
    SessionsResponse,
    SkillsResponse,
)
from app.sessions import get_session_detail, list_sessions, session_exists
from app.skills import handle_skill_command, list_skills


logger = logging.getLogger("pixy.server")
runtime = HermesRuntime()


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
        memory_evidence = extract_memory_evidence(paths)
        skill_response = handle_skill_command(
            runtime,
            paths,
            message=raw_message,
            session_id=payload.session_id,
            request_id=request_id_from(request),
        )
        if skill_response is not None:
            skill_response.memory_evidence = memory_evidence
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
        response.memory_evidence = memory_evidence
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
        return list_skills(runtime, resolve_paths())

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
