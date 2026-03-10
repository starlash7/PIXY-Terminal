import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.PIXY_BACKEND_URL ?? "http://127.0.0.1:8000";

function backendUrl(path: string): string {
  return new URL(path, BACKEND_URL).toString();
}

async function safeJson(response: Response): Promise<unknown> {
  return response.json().catch(() => ({
    error: {
      code: "invalid_backend_response",
      message: "Backend returned a non-JSON response.",
    },
  }));
}

function proxyFailure(error: unknown): NextResponse {
  return NextResponse.json(
    {
      error: {
        code: "backend_unreachable",
        message:
          error instanceof Error
            ? error.message
            : "The FastAPI backend is not reachable.",
      },
    },
    { status: 503 },
  );
}

export async function proxyGet(path: string): Promise<NextResponse> {
  try {
    const response = await fetch(backendUrl(path), {
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    return NextResponse.json(await safeJson(response), { status: response.status });
  } catch (error) {
    return proxyFailure(error);
  }
}

export async function proxyPost(path: string, request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.text();
    const response = await fetch(backendUrl(path), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": request.headers.get("content-type") || "application/json",
      },
      body,
      cache: "no-store",
    });

    return NextResponse.json(await safeJson(response), { status: response.status });
  } catch (error) {
    return proxyFailure(error);
  }
}
