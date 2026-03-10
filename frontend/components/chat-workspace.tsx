"use client";

import { useEffect, useEffectEvent, useState, useTransition } from "react";

import { AppShell } from "@/components/app-shell";
import { MarkdownBlock } from "@/components/markdown-block";
import { getJson, postJson } from "@/lib/client";
import type {
  ChatResponse,
  HealthResponse,
  MemoryResponse,
  SessionCard,
  SessionsResponse,
} from "@/lib/types";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
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
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isPending, startTransition] = useTransition();

  const refreshPanels = useEffectEvent(async () => {
    const { memoryData, sessionsData, healthData } = await loadPanelData();
    setMemory(memoryData);
    setSessions(sessionsData.sessions.slice(0, 4));
    setHealth(healthData);
  });

  useEffect(() => {
    void refreshPanels().catch((refreshError) => {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "Failed to load the PIXY side panels.",
      );
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
    setError(null);
    setWarnings([]);
    setIsSending(true);
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
          },
        ]);
        setSessionId(response.session_id);
        setWarnings(response.warnings);
      });

      const { memoryData, sessionsData, healthData } = await loadPanelData();
      startTransition(() => {
        setMemory(memoryData);
        setSessions(sessionsData.sessions.slice(0, 4));
        setHealth(healthData);
      });
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "PIXY could not complete that request.";

      startTransition(() => {
        setMessages((current) => [
          ...current,
          {
            id: `assistant-error-${Date.now()}`,
            role: "assistant",
            content: `Request failed.\n\n${message}`,
          },
        ]);
        setError(message);
      });
    } finally {
      setIsSending(false);
    }
  }

  return (
    <AppShell
      title="A browser-native shell for Hermes."
      description="Chat from desktop or phone, inspect the memory layer, and keep skill growth visible instead of buried in local files."
      accentLabel={health?.hermes_available ? "Live Hermes" : "Simulator"}
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
              {health?.hermes_available
                ? "Hermes runtime detected"
                : "Hermes missing, simulator enabled"}
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
                  <span>{message.role === "assistant" ? "Rendered Markdown" : "Input"}</span>
                </div>
                {message.role === "assistant" ? (
                  <MarkdownBlock content={message.content} />
                ) : (
                  <p className="whitespace-pre-wrap text-sm leading-7 text-white">
                    {message.content}
                  </p>
                )}
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

          {error ? (
            <section className="glass-panel rounded-[1.5rem] border-[rgba(255,143,123,0.22)] p-4">
              <p className="text-xs uppercase tracking-[0.28em] text-[var(--danger)]">
                Error state
              </p>
              <p className="mt-3 text-sm leading-7 text-white">{error}</p>
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
