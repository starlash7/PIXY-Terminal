from __future__ import annotations

from pathlib import Path
from typing import Any, Optional
from uuid import uuid4

from fastapi import Request, status


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


def request_id_from(request: Optional[Request]) -> str:
    if request is None:
        return uuid4().hex[:12]
    request_id = getattr(request.state, "request_id", None)
    return request_id if isinstance(request_id, str) and request_id else uuid4().hex[:12]
