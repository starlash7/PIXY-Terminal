import type { ApiErrorPayload } from "@/lib/types";

type ApiClientErrorOptions = {
  message: string;
  status: number;
  code: string;
  requestId: string | null;
  details?: Record<string, unknown>;
};

export class ApiClientError extends Error {
  status: number;
  code: string;
  requestId: string | null;
  details?: Record<string, unknown>;

  constructor({ message, status, code, requestId, details }: ApiClientErrorOptions) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.details = details;
  }
}

function toApiClientError(
  response: Response,
  payload: ApiErrorPayload | null,
): ApiClientError {
  return new ApiClientError({
    status: response.status,
    code: payload?.error?.code ?? "request_failed",
    message:
      payload?.error?.message ||
      "The request failed before PIXY received a valid response.",
    requestId: payload?.error?.request_id ?? response.headers.get("x-pixy-request-id"),
    details: payload?.error?.details,
  });
}

async function parsePayload<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as T | ApiErrorPayload | null;
  if (!response.ok) {
    throw toApiClientError(response, payload as ApiErrorPayload | null);
  }
  if (!payload) {
    throw new ApiClientError({
      status: response.status,
      code: "missing_json_payload",
      message: "The request completed without a JSON payload.",
      requestId: response.headers.get("x-pixy-request-id"),
    });
  }
  return payload as T;
}

export function isApiClientError(error: unknown): error is ApiClientError {
  return error instanceof ApiClientError;
}

export async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  return parsePayload<T>(response);
}

export async function postJson<T>(
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return parsePayload<T>(response);
}
