import type { ApiErrorPayload } from "@/lib/types";

async function parsePayload<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as T | ApiErrorPayload | null;
  if (!response.ok) {
    const errorPayload = payload as ApiErrorPayload | null;
    throw new Error(
      errorPayload?.error?.message || "The request failed before PIXY received a valid response.",
    );
  }
  if (!payload) {
    throw new Error("The request completed without a JSON payload.");
  }
  return payload as T;
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
