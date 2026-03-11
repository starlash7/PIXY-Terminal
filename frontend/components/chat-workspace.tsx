"use client";

import { useEffect, useEffectEvent, useState, useTransition } from "react";

import { AppShell } from "@/components/app-shell";
import { MarkdownBlock } from "@/components/markdown-block";
import { getJson, isApiClientError, postJson } from "@/lib/client";
import type {
  ChatResponse,
  HealthResponse,
  MemoryResponse,
  RuntimeMode,
  SessionCard,
  SessionsResponse,
} from "@/lib/types";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  status?: "ok" | "error";
  meta?: {
    requestId?: string | null;
    mode?: RuntimeMode | null;
    generatedAt?: string | null;
    code?: string | null;
    statusCode?: number | null;
  };
};

type RequestState = {
  status: "idle" | "sending" | "succeeded" | "failed";
  message: string;
  code: string | null;
  requestId: string | null;
  mode: RuntimeMode | null;
  updatedAt: string | null;
  statusCode: number | null;
};

type ErrorSummary = {
  message: string;
  code: string;
  requestId: string | null;
  statusCode: number | null;
  details?: Record<string, unknown>;
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function modeLabel(mode: RuntimeMode | null | undefined): string {
  switch (mode) {
    case "python_api":
      return "Hermes API";
    case "cli":
      return "Hermes CLI";
    case "simulator":
      return "Simulator";
    default:
      return "Unknown runtime";
  }
}

function summarizeError(error: unknown): ErrorSummary {
  if (isApiClientError(error)) {
    return {
      message: error.message,
      code: error.code,
      requestId: error.requestId,
      statusCode: error.status,
      details: error.details,
    };
  }

  return {
    message:
      error instanceof Error ? error.message : "PIXY could not complete that request.",
    code: "unknown_error",
    requestId: null,
    statusCode: null,
  };
}

function failureTranscript(summary: ErrorSummary): string {
  const lines = ["Request failed.", "", summary.message, ""];

  lines.push(`Error code: \`${summary.code}\``);

  if (summary.statusCode) {
    lines.push(`HTTP status: \`${summary.statusCode}\``);
  }

  if (summary.requestId) {
    lines.push(`Request ID: \`${summary.requestId}\``);
  }

  if (summary.details && Object.keys(summary.details).length > 0) {
    lines.push("");
    lines.push("```json");
    lines.push(JSON.stringify(summary.details, null, 2));
    lines.push("```");
  }

  return lines.join("\n");
}

async function loadPanelData(): Promise<{
  memoryData: MemoryResponse;
  sessionsData: SessionsResponse;
  healthData: HealthResponse;
}> {
  const [memoryData, sessionsData, healthData] = await Promise.all([
    getJson<MemoryResponse>("/api/memory"),
    getJson<SessionsResponse>("/api/sessions"),
    getJson<HealthResponse>("/api/health"),
  ]);

  return { memoryData, sessionsData, healthData };
}

export function ChatWorkspace() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "boot",
      role: "assistant",
      content:
        "PIXY is online. Start with a task, a note, or a prompt for Hermes to turn into a reusable workflow.",
    },
  ]);
  const [draft, setDraft] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [memory, setMemory] = useState<MemoryResponse | null>(null);
  const [sessions, setSessions] = useState<SessionCard[]>([]);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [lastRequest, setLastRequest] = useState<RequestState>({
    status: "idle",
    message: "No prompt has been sent yet.",
    code: null,
    requestId: null,
    mode: null,
    updatedAt: null,
    statusCode: null,
  });

  const refreshPanels = useEffectEvent(async () => {
    const { memoryData, sessionsData, healthData } = await loadPanelData();
    setMemory(memoryData);
    setSessions(sessionsData.sessions.slice(0, 4));
    setHealth(healthData);
  });

  useEffect(() => {
    void refreshPanels().catch((refreshError) => {
      const summary = summarizeError(refreshError);
      setPanelError(summary.message);
    });
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = draft.trim();
    if (!trimmed || isSending) {
      return;
    }

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
    };

    setDraft("");
    setPanelError(null);
    setWarnings([]);
    setIsSending(true);
    setLastRequest({
      status: "sending",
      message: "Prompt delivered from the browser. Waiting for Hermes.",
      code: null,
      requestId: null,
      mode: health?.runtime_mode ?? null,
      updatedAt: new Date().toISOString(),
      statusCode: null,
    });
    setMessages((current) => [...current, userMessage]);

    try {
      const response = await postJson<ChatResponse>("/api/chat", {
        message: trimmed,
        session_id: sessionId,
      });

      startTransition(() => {
        setMessages((current) => [
          ...current,
          {
            id: `assistant-${response.generated_at}`,
            role: "assistant",
            content: response.reply,
            status: "ok",
            meta: {
              requestId: response.request_id,
              mode: response.mode,
              generatedAt: response.generated_at,
              statusCode: 200,
            },
          },
        ]);
        setSessionId(response.session_id);
        setWarnings(response.warnings);
        setLastRequest({
          status: "succeeded",
          message: `${modeLabel(response.mode)} returned a visible reply.`,
          code: null,
          requestId: response.request_id,
          mode: response.mode,
          updatedAt: response.generated_at,
          statusCode: 200,
        });
      });

      const nextPanels = await loadPanelData().catch((refreshError) => {
        const summary = summarizeError(refreshError);
        setPanelError(summary.message);
        return null;
      });

      if (nextPanels) {
        startTransition(() => {
          setMemory(nextPanels.memoryData);
          setSessions(nextPanels.sessionsData.sessions.slice(0, 4));
          setHealth(nextPanels.healthData);
        });
      }
    } catch (submitError) {
      const summary = summarizeError(submitError);
      const updatedAt = new Date().toISOString();

      startTransition(() => {
        setMessages((current) => [
          ...current,
          {
            id: `assistant-error-${updatedAt}`,
            role: "assistant",
            content: failureTranscript(summary),
            status: "error",
            meta: {
              requestId: summary.requestId,
              generatedAt: updatedAt,
              code: summary.code,
              statusCode: summary.statusCode,
            },
          },
        ]);
        setLastRequest({
          status: "failed",
          message: summary.message,
          code: summary.code,
          requestId: summary.requestId,
          mode: null,
          updatedAt,
          statusCode: summary.statusCode,
        });
      });
    } finally {
      setIsSending(false);
    }
  }

  return (
    <AppShell
      title="A browser-native shell for Hermes."
      description="Chat from desktop or phone, inspect the memory layer, and keep skill growth visible instead of buried in local files."
      accentLabel={
        health?.runtime_mode === "python_api"
          ? "Live Hermes API"
          : health?.runtime_mode === "cli"
            ? "Live Hermes CLI"
            : "Simulator"
      }
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.8fr)]">
        <section className="glass-panel rounded-[1.75rem] p-3 sm:p-4">
          <div className="flex flex-col gap-3 border-b border-white/6 px-2 pb-4 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted)]">
                Conversation
              </p>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Session {sessionId ?? "will start on first live request"}
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-2 text-xs text-[var(--muted)]">
              <span className="pulse-dot h-2 w-2 rounded-full bg-[var(--accent-strong)]" />
              {health?.runtime_mode
                ? `${modeLabel(health.runtime_mode)} detected`
                : "Detecting runtime"}
            </div>
          </div>

          <div className="flex min-h-[420px] flex-col gap-4 px-2 py-5">
            {messages.map((message) => (
              <article
                key={message.id}
                className={`max-w-[92%] rounded-[1.5rem] border px-4 py-4 ${
                  message.role === "user"
                    ? "ml-auto border-[var(--line)] bg-[rgba(159,255,208,0.08)] text-white"
                    : "border-white/8 bg-black/20 text-[var(--fg)]"
                }`}
              >
                <div className="mb-3 flex items-center justify-between gap-3 text-[0.72rem] uppercase tracking-[0.22em] text-[var(--muted)]">
                  <span>{message.role === "user" ? "You" : "PIXY"}</span>
                  <span>
                    {message.role === "assistant"
                      ? message.status === "error"
                        ? "Failure trace"
                        : "Rendered Markdown"
                      : "Input"}
                  </span>
                </div>
                {message.role === "assistant" ? (
                  <MarkdownBlock content={message.content} />
                ) : (
                  <p className="whitespace-pre-wrap text-sm leading-7 text-white">
                    {message.content}
                  </p>
                )}
                {message.role === "assistant" && message.meta ? (
                  <div className="mt-4 flex flex-wrap gap-2 text-[0.68rem] uppercase tracking-[0.18em] text-[var(--muted)]">
                    {message.meta.mode ? (
                      <span className="rounded-full border border-white/10 px-2.5 py-1">
                        {modeLabel(message.meta.mode)}
                      </span>
                    ) : null}
                    {message.meta.code ? (
                      <span className="rounded-full border border-[rgba(255,143,123,0.25)] px-2.5 py-1 text-[var(--danger)]">
                        {message.meta.code}
                      </span>
                    ) : null}
                    {message.meta.requestId ? (
                      <span className="rounded-full border border-white/10 px-2.5 py-1">
                        Request {message.meta.requestId}
                      </span>
                    ) : null}
                    {message.meta.statusCode ? (
                      <span className="rounded-full border border-white/10 px-2.5 py-1">
                        HTTP {message.meta.statusCode}
                      </span>
                    ) : null}
                    {message.meta.generatedAt ? (
                      <span className="rounded-full border border-white/10 px-2.5 py-1">
                        {formatDate(message.meta.generatedAt)}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </article>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="border-t border-white/6 px-2 pt-4">
            <label className="mb-3 block text-xs uppercase tracking-[0.28em] text-[var(--muted)]">
              Prompt
            </label>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={4}
              placeholder="Ask for a web3 briefing, a reusable skill, or a memory update."
              className="w-full rounded-[1.3rem] border border-white/10 bg-black/30 px-4 py-4 text-sm leading-7 text-white outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--glow)]"
            />
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-[var(--muted)]">
                {isSending
                  ? "Waiting for Hermes..."
                  : "No silent failures. Errors land in the transcript."}
              </div>
              <button
                type="submit"
                disabled={isSending || !draft.trim()}
                className="rounded-full border border-[var(--accent)] bg-[var(--glow)] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[rgba(73,227,165,0.24)] disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/6 disabled:text-[var(--muted)]"
              >
                {isSending || isPending ? "Sending..." : "Run prompt"}
              </button>
            </div>
          </form>
        </section>

        <aside className="flex flex-col gap-4">
          <section className="glass-panel rounded-[1.5rem] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted)]">
                  Last request
                </p>
                <p className="mt-2 text-sm text-white">{lastRequest.message}</p>
              </div>
              <span
                className={`rounded-full border px-3 py-1 text-xs ${
                  lastRequest.status === "succeeded"
                    ? "border-[rgba(73,227,165,0.28)] text-[var(--accent)]"
                    : lastRequest.status === "failed"
                      ? "border-[rgba(255,143,123,0.25)] text-[var(--danger)]"
                      : "border-white/10 text-[var(--muted)]"
                }`}
              >
                {lastRequest.status}
              </span>
            </div>
            <div className="mt-4 space-y-2 text-sm leading-7 text-[var(--muted)]">
              <p>Runtime: {lastRequest.mode ? modeLabel(lastRequest.mode) : "Pending"}</p>
              <p>Request ID: {lastRequest.requestId ?? "Will appear on response"}</p>
              <p>HTTP status: {lastRequest.statusCode?.toString() ?? "Pending"}</p>
              <p>Error code: {lastRequest.code ?? "None"}</p>
              <p>
                Updated:{" "}
                {lastRequest.updatedAt ? formatDate(lastRequest.updatedAt) : "No request yet"}
              </p>
            </div>
          </section>

          {warnings.length > 0 ? (
            <section className="glass-panel rounded-[1.5rem] border-[rgba(255,207,112,0.2)] p-4">
              <p className="text-xs uppercase tracking-[0.28em] text-[var(--warning)]">
                Runtime warning
              </p>
              <div className="mt-3 space-y-2 text-sm leading-7 text-white">
                {warnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            </section>
          ) : null}

          {health?.issues.length ? (
            <section className="glass-panel rounded-[1.5rem] border-[rgba(255,207,112,0.2)] p-4">
              <p className="text-xs uppercase tracking-[0.28em] text-[var(--warning)]">
                Runtime diagnostics
              </p>
              <div className="mt-3 space-y-2 text-sm leading-7 text-white">
                {health.issues.map((issue) => (
                  <p key={issue}>{issue}</p>
                ))}
              </div>
            </section>
          ) : null}

          {panelError ? (
            <section className="glass-panel rounded-[1.5rem] border-[rgba(255,143,123,0.22)] p-4">
              <p className="text-xs uppercase tracking-[0.28em] text-[var(--danger)]">
                Panel error
              </p>
              <p className="mt-3 text-sm leading-7 text-white">{panelError}</p>
            </section>
          ) : null}

          <section className="glass-panel rounded-[1.5rem] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted)]">
                  Memory layer
                </p>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {memory?.path ?? "No memory file found yet."}
                </p>
              </div>
              <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-[var(--muted)]">
                {(memory?.content.split(/\s+/).filter(Boolean).length ?? 0).toString()} words
              </span>
            </div>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-white/88">
              {memory?.content.slice(0, 480) || "Hermes has not persisted memory to disk yet."}
            </p>
          </section>

          <section className="glass-panel rounded-[1.5rem] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted)]">
                  Recent sessions
                </p>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Desktop to phone continuity starts here.
                </p>
              </div>
              <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-[var(--muted)]">
                {sessions.length} tracked
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {sessions.length > 0 ? (
                sessions.map((session) => (
                  <article
                    key={session.id}
                    className="rounded-[1.2rem] border border-white/8 bg-black/20 p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-white">{session.title}</p>
                      <span className="text-xs text-[var(--muted)]">
                        {formatDate(session.last_updated)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                      {session.preview}
                    </p>
                  </article>
                ))
              ) : (
                <p className="text-sm leading-7 text-[var(--muted)]">
                  Send a live Hermes message and session logs from `~/.hermes/sessions` will appear here.
                </p>
              )}
            </div>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
