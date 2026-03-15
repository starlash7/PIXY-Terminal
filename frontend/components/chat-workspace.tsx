"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";

import { AgentPresence } from "@/components/agent-presence";
import { MarkdownBlock } from "@/components/markdown-block";
import { getJson, postJson } from "@/lib/client";
import { buildThoughtCue, type AgentState, type ThoughtCue } from "@/lib/agent-presence";
import type {
  ChatResponse,
  HealthResponse,
  MemoryResponse,
  SessionDetailResponse,
  SkillInvocation,
  SessionsResponse,
} from "@/lib/types";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  skillInvocation?: SkillInvocation | null;
  memoryEvidence?: string[] | null;
};

type WindowMode = "windowed" | "maximized" | "minimized";
type TraceStatus = "idle" | "active" | "done";

function clearTimeoutRef(timeoutRef: React.MutableRefObject<number | null>) {
  if (timeoutRef.current !== null) {
    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }
}

function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(timestamp));
}

function resolveTimestamp(value: number | string | null | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeLine(line: string): string {
  return line
    .replace(/^[-*#>\d.\s]+/, "")
    .replace(/[`*_]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function summarizeText(value: string, maxLength = 58): string {
  const normalized = normalizeLine(value);
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

function extractMemorySignals(content: string | null | undefined): string[] {
  if (!content) {
    return [];
  }

  return Array.from(
    new Set(
      content
        .split("\n")
        .map(normalizeLine)
        .filter((line) => line.length > 24),
    ),
  ).slice(0, 3);
}

function shortSessionLabel(sessionId: string | null): string {
  if (!sessionId) {
    return "new-thread";
  }

  return sessionId.length > 14 ? `${sessionId.slice(0, 14)}…` : sessionId;
}

function extractOpenLoops(messages: Message[], warnings: string[]): string[] {
  const pending = messages
    .filter((message) => message.role === "user")
    .slice(-3)
    .map((message) => summarizeText(message.content, 52));

  if (warnings.length > 0) {
    pending.unshift(`Review warning path: ${summarizeText(warnings[0], 36)}`);
  }

  return Array.from(new Set(pending)).slice(0, 3);
}

function buildStateTrace(agentState: AgentState, isSending: boolean, hasWarning: boolean) {
  const activeKey = hasWarning
    ? "fallback"
    : isSending
      ? agentState === "listening"
        ? "listening"
        : agentState === "thinking"
          ? "memory"
          : "compose"
      : "settled";
  const steps = [
    { key: "listening", label: "Intent capture" },
    { key: "memory", label: "Memory link" },
    { key: "compose", label: "Response draft" },
    { key: "settled", label: "Thread settled" },
  ];
  const activeIndex = steps.findIndex((step) => step.key === activeKey);

  return steps.map((step, index) => {
    let status: TraceStatus = "idle";

    if (index < activeIndex) {
      status = "done";
    } else if (index === activeIndex) {
      status = "active";
    }

    return {
      ...step,
      status,
    };
  });
}

function RuntimePulseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-5 w-5 text-[var(--accent-green)]"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 12h4l2.2-6.2L12 18l2.7-8 2.1 4H22" />
    </svg>
  );
}

function MemoryLayerIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-5 w-5 text-[var(--accent-green)]"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11.25 5.1c-.7-1-1.9-1.6-3.2-1.6-2.1 0-3.8 1.7-3.8 3.8 0 .7.2 1.4.5 2A3.95 3.95 0 0 0 4 16.3a4 4 0 0 0 5 3.7c.7.5 1.5.8 2.25.8" />
      <path d="M12.75 5.1c.7-1 1.9-1.6 3.2-1.6 2.1 0 3.8 1.7 3.8 3.8 0 .7-.2 1.4-.5 2a3.95 3.95 0 0 1 .75 7 4 4 0 0 1-5 3.7c-.7.5-1.5.8-2.25.8" />
      <path d="M12 4.8v14.4" />
      <path d="M8.2 7.8c1 .1 1.8 1 1.8 2.1" />
      <path d="M8.2 11.7c1 .1 1.8 1 1.8 2.1" />
      <path d="M8.2 15.6c.9 0 1.7-.6 1.9-1.5" />
      <path d="M15.8 7.8c-1 .1-1.8 1-1.8 2.1" />
      <path d="M15.8 11.7c-1 .1-1.8 1-1.8 2.1" />
      <path d="M15.8 15.6c-.9 0-1.7-.6-1.9-1.5" />
    </svg>
  );
}

export function ChatWorkspace() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [memory, setMemory] = useState<MemoryResponse | null>(null);
  const [sessions, setSessions] = useState<SessionsResponse | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [windowMode, setWindowMode] = useState<WindowMode>("windowed");
  const [threadMode, setThreadMode] = useState<"resume" | "new">("resume");
  const [agentState, setAgentState] = useState<AgentState>("idle");
  const [thoughtCue, setThoughtCue] = useState<ThoughtCue | null>(null);
  const [isPending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const thoughtTimeoutRef = useRef<number | null>(null);
  const thinkingTimeoutRef = useRef<number | null>(null);
  const settleTimeoutRef = useRef<number | null>(null);
  const lastThoughtTextRef = useRef<string | null>(null);
  const hydratedSessionRef = useRef<string | null>(null);

  async function refreshContext() {
    const [healthResult, memoryResult, sessionsResult] = await Promise.allSettled([
      getJson<HealthResponse>("/api/health"),
      getJson<MemoryResponse>("/api/memory"),
      getJson<SessionsResponse>("/api/sessions"),
    ]);

    if (healthResult.status === "fulfilled") {
      setHealth(healthResult.value);
    }
    if (memoryResult.status === "fulfilled") {
      setMemory(memoryResult.value);
    }
    if (sessionsResult.status === "fulfilled") {
      setSessions(sessionsResult.value);
    }
  }

  useEffect(() => {
    void refreshContext().catch(() => {});
  }, []);

  useEffect(() => {
    if (threadMode === "new" || sessionId || messages.length > 0) {
      return;
    }
    const latestSessionId = sessions?.sessions[0]?.id ?? null;
    if (latestSessionId) {
      setSessionId(latestSessionId);
    }
  }, [messages.length, sessionId, sessions, threadMode]);

  useEffect(() => {
    if (!sessionId || messages.length > 0 || hydratedSessionRef.current === sessionId) {
      return;
    }

    let cancelled = false;

    void getJson<SessionDetailResponse>(`/api/sessions/${sessionId}`)
      .then((detail) => {
        if (cancelled) {
          return;
        }
        hydratedSessionRef.current = sessionId;
        setMessages(
          detail.messages.map((message) => ({
            id: message.id,
            role: message.role,
            content: message.content,
            createdAt: resolveTimestamp(message.created_at) ?? Date.now(),
          })),
        );
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [messages.length, sessionId]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) {
      return;
    }

    container.scrollTop = container.scrollHeight;
  }, [messages, isSending]);

  useEffect(() => {
    return () => {
      clearTimeoutRef(thoughtTimeoutRef);
      clearTimeoutRef(thinkingTimeoutRef);
      clearTimeoutRef(settleTimeoutRef);
    };
  }, []);

  function showThought(nextState: AgentState) {
    setAgentState(nextState);

    const cue = buildThoughtCue(nextState, lastThoughtTextRef.current);
    clearTimeoutRef(thoughtTimeoutRef);

    if (!cue) {
      setThoughtCue(null);
      return;
    }

    lastThoughtTextRef.current = cue.text;
    setThoughtCue(cue);
    thoughtTimeoutRef.current = window.setTimeout(() => {
      setThoughtCue((current) => (current?.id === cue.id ? null : current));
      thoughtTimeoutRef.current = null;
    }, cue.durationMs);
  }

  function settlePresence(nextState: AgentState = "idle", durationMs = 1400) {
    clearTimeoutRef(settleTimeoutRef);
    settleTimeoutRef.current = window.setTimeout(() => {
      setAgentState(nextState);
      setThoughtCue(null);
      settleTimeoutRef.current = null;
    }, durationMs);
  }

  function switchThread(nextSessionId: string | null) {
    hydratedSessionRef.current = null;
    clearTimeoutRef(thoughtTimeoutRef);
    clearTimeoutRef(thinkingTimeoutRef);
    clearTimeoutRef(settleTimeoutRef);
    setMessages([]);
    setWarnings([]);
    setError(null);
    setThoughtCue(null);
    setAgentState("idle");
    setSessionId(nextSessionId);
    setThreadMode(nextSessionId ? "resume" : "new");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = draft.trim();
    if (!trimmed || isSending) {
      return;
    }

    const submittedAt = Date.now();
    const userMessage: Message = {
      id: `user-${submittedAt}`,
      role: "user",
      content: trimmed,
      createdAt: submittedAt,
    };

    setDraft("");
    setError(null);
    setWarnings([]);
    clearTimeoutRef(settleTimeoutRef);
    clearTimeoutRef(thinkingTimeoutRef);
    setIsSending(true);
    setMessages((current) => [...current, userMessage]);
    showThought("listening");
    thinkingTimeoutRef.current = window.setTimeout(() => {
      showThought("thinking");
      thinkingTimeoutRef.current = null;
    }, 520);

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
            createdAt: Date.now(),
            skillInvocation: response.skill_invocation ?? null,
            memoryEvidence: response.memory_evidence ?? [],
          },
        ]);
        setSessionId(response.session_id);
        hydratedSessionRef.current = response.session_id;
        setThreadMode("resume");
        setWarnings(response.warnings);
      });
      clearTimeoutRef(thinkingTimeoutRef);
      const finalState = response.warnings.length > 0 ? "warning" : "responding";
      showThought(finalState);
      settlePresence("idle", finalState === "warning" ? 2200 : 1150);
      void refreshContext().catch(() => {});
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Hermes could not complete that request.";

      startTransition(() => {
        setMessages((current) => [
          ...current,
          {
            id: `assistant-error-${Date.now()}`,
            role: "assistant",
            content: `Request failed.\n\n${message}`,
            createdAt: Date.now(),
          },
        ]);
        setError(message);
      });
      clearTimeoutRef(thinkingTimeoutRef);
      showThought("warning");
      settlePresence("idle", 2400);
    } finally {
      setIsSending(false);
    }
  }

  const startedAt = messages[0]?.createdAt ?? Date.now();
  const lastEventAt = messages[messages.length - 1]?.createdAt ?? startedAt;
  const showWindowBody = windowMode !== "minimized";
  const showDock = windowMode === "windowed";
  const pagePaddingClass = windowMode === "maximized" ? "px-0 py-0" : "px-6 py-6";
  const containerWidthClass =
    windowMode === "maximized"
      ? "max-w-none"
      : windowMode === "minimized"
        ? "max-w-[42rem]"
        : "max-w-[1160px]";
  const stageHeightClass =
    windowMode === "maximized"
      ? "h-full"
      : windowMode === "minimized"
        ? "h-[3.75rem]"
        : "h-[42rem]";
  const stageShapeClass =
    windowMode === "maximized"
      ? "rounded-none border-x-0 border-y-0"
      : "rounded-[28px]";
  const memorySignals = extractMemorySignals(memory?.content);
  const activeSession =
    threadMode === "new"
      ? (sessionId ? sessions?.sessions.find((entry) => entry.id === sessionId) ?? null : null)
      : sessions?.sessions.find((entry) => entry.id === sessionId) ?? sessions?.sessions[0] ?? null;
  const openLoops = extractOpenLoops(messages, warnings);
  const continuityOpenLoops =
    openLoops.length > 0
      ? openLoops
      : [
          activeSession?.title ? `Resume thread: ${summarizeText(activeSession.title, 48)}` : null,
          activeSession?.preview ? `Follow up: ${summarizeText(activeSession.preview, 52)}` : null,
          memorySignals[0] ? `Carry memory: ${summarizeText(memorySignals[0], 48)}` : null,
        ].filter((value): value is string => Boolean(value));
  const continuitySessionId = sessionId ?? activeSession?.id ?? null;
  const continuityLastSyncAt = resolveTimestamp(
    messages.length > 0 ? lastEventAt : activeSession?.last_updated ?? lastEventAt,
  ) ?? lastEventAt;
  const continuityTitle = activeSession?.title
    ? summarizeText(activeSession.title, 26)
    : threadMode === "new"
      ? "new thread"
      : shortSessionLabel(continuitySessionId);
  const continuityHeadline = activeSession?.title
    ? summarizeText(activeSession.title, 44)
    : threadMode === "new"
      ? "new thread"
      : shortSessionLabel(continuitySessionId);
  const continuityPreview = activeSession?.preview ? summarizeText(activeSession.preview, 40) : null;
  const continuityVerb = threadMode === "new" ? "Starting" : "Resumed";
  const continuityMetricValue = String(activeSession?.message_count ?? messages.length).padStart(2, "0");
  const latestAssistantId = [...messages].reverse().find((message) => message.role === "assistant")?.id;
  const stateTrace = buildStateTrace(agentState, isSending, warnings.length > 0 || Boolean(error));
  const recentLearning =
    memorySignals[1] ??
    messages
      .filter((message) => message.role === "user")
      .slice(-1)
      .map((message) => summarizeText(message.content, 54))[0] ??
    "No durable memory written yet.";
  const activeFocus =
    continuityOpenLoops[0] ??
    summarizeText(activeSession?.preview ?? "Waiting for the next instruction.", 56);

  return (
    <div
      className="flex min-h-screen flex-col bg-[var(--bg-primary)]"
      style={{ fontFamily: "var(--font-pixel)" }}
    >
      <div className="border-b border-[var(--border-default)] px-6 py-4">
        <h1 className="text-[20px] font-semibold text-[var(--accent-amber)]">PIXY TERMINAL</h1>
      </div>
      <div className={`min-h-0 flex-1 ${pagePaddingClass}`}>
        <div className={`mx-auto flex h-full ${containerWidthClass} flex-col gap-4`}>
          <section
            className={`cyber-stage terminal-grid terminal-scanlines pixel-frame shader-shell flex-none ${stageShapeClass} ${stageHeightClass}`}
          >
            <div className="flex items-center justify-between border-b border-[var(--border-default)] px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="group relative">
                    <button
                      type="button"
                      aria-label="Minimize window"
                      onClick={() => setWindowMode("minimized")}
                      className={`h-[14px] w-[14px] rounded-full bg-[#ff5f57] transition-transform duration-150 ${
                        windowMode === "minimized"
                          ? "scale-110 ring-2 ring-white/18"
                          : "hover:scale-110"
                      }`}
                    >
                      <span className="flex h-full w-full items-center justify-center text-[10px] font-bold leading-none text-black opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                        x
                      </span>
                    </button>
                  </div>
                  <div className="group relative">
                    <button
                      type="button"
                      aria-label="Window mode"
                      onClick={() => setWindowMode("windowed")}
                      className={`h-[14px] w-[14px] rounded-full bg-[#febc2e] transition-transform duration-150 ${
                        windowMode === "windowed"
                          ? "scale-110 ring-2 ring-white/18"
                          : "hover:scale-110"
                      }`}
                    >
                      <span className="flex h-full w-full items-center justify-center text-[11px] font-bold leading-none text-black opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                        _
                      </span>
                    </button>
                  </div>
                  <div className="group relative">
                    <button
                      type="button"
                      aria-label="Maximize window"
                      onClick={() => setWindowMode("maximized")}
                      className={`h-[14px] w-[14px] rounded-full bg-[#28c840] transition-transform duration-150 ${
                        windowMode === "maximized"
                          ? "scale-110 ring-2 ring-white/18"
                          : "hover:scale-110"
                      }`}
                    >
                      <span className="flex h-full w-full items-center justify-center text-[10px] font-bold leading-none text-black opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                        +
                      </span>
                    </button>
                  </div>
                </div>
                <span className="text-[12px] text-[var(--text-muted)]">~/pixy/chat</span>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href="/chat"
                  className="rounded-full border border-[rgba(168,85,247,0.24)] bg-[linear-gradient(180deg,rgba(168,85,247,0.18),rgba(168,85,247,0.08))] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-[var(--accent-purple)] transition-all duration-150"
                  style={{ fontFamily: "var(--font-pixel)" }}
                >
                  chat
                </Link>
                <Link
                  href="/dashboard"
                  className="rounded-full border border-[var(--border-default)] bg-[rgba(12,12,12,0.64)] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)] transition-all duration-150 hover:text-[var(--text-primary)]"
                  style={{ fontFamily: "var(--font-pixel)" }}
                >
                  dashboard
                </Link>
                <Link
                  href="/skills"
                  className="rounded-full border border-[var(--border-default)] bg-[rgba(12,12,12,0.64)] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)] transition-all duration-150 hover:text-[var(--text-primary)]"
                  style={{ fontFamily: "var(--font-pixel)" }}
                >
                  skills
                </Link>
                <select
                  value={threadMode === "new" ? "" : continuitySessionId ?? ""}
                  onChange={(event) => switchThread(event.target.value || null)}
                  className="h-8 min-w-[12rem] rounded-full border border-[var(--border-default)] bg-[rgba(12,12,12,0.72)] px-3 text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)] outline-none"
                  style={{ fontFamily: "var(--font-pixel)" }}
                >
                  <option value="">new thread</option>
                  {sessions?.sessions.slice(0, 8).map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {summarizeText(entry.title, 28)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {showWindowBody ? (
              <div className="relative flex h-[calc(100%-57px)] flex-col">
                <div className="relative min-h-0 flex-1 overflow-hidden">
                  <AgentPresence
                    state={agentState}
                    thoughtCue={thoughtCue}
                    messageCount={messages.length}
                    hasWarning={Boolean(error) || warnings.length > 0}
                  />

                  <div ref={scrollRef} className="relative z-0 h-full overflow-y-auto">
                    <div className="px-6 py-6 pb-10 pr-[20rem]">
                      <div className="max-w-[780px] space-y-4">
                        <article className="pixel-frame depth-panel overflow-hidden rounded-[20px] border border-[rgba(168,85,247,0.22)] px-4 py-4">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <span
                                className="text-[11px] uppercase tracking-[0.2em] text-[var(--accent-purple)]"
                                style={{ fontFamily: "var(--font-pixel)" }}
                              >
                                thread continuity
                              </span>
                              <p className="mt-2 text-[15px] leading-7 text-[var(--text-primary)]">
                                {continuityVerb}{" "}
                                <span className="text-[rgba(196,181,253,0.95)]">
                                  {continuityHeadline}
                                </span>
                                {continuityPreview ? ` with ${continuityPreview}` : "."}
                              </p>
                              <div className="mt-3 flex flex-wrap gap-2">
                                <span className="rounded-full border border-[rgba(168,85,247,0.18)] bg-[rgba(168,85,247,0.08)] px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-[var(--accent-purple)]">
                                  {health?.runtime_mode ?? "link-pending"}
                                </span>
                                <span className="rounded-full border border-[rgba(34,197,94,0.18)] bg-[rgba(34,197,94,0.08)] px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-[var(--accent-green)]">
                                  memory {memorySignals.length > 0 ? "linked" : "warming"}
                                </span>
                                <span className="rounded-full border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)] px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
                                  {continuityOpenLoops.length} open loops
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
                                last activity
                              </p>
                              <p className="mt-2 text-[13px] text-[var(--text-primary)]">
                                {formatTime(continuityLastSyncAt)}
                              </p>
                            </div>
                          </div>
                          {continuityOpenLoops.length > 0 ? (
                            <div className="mt-4 grid gap-2">
                              {continuityOpenLoops.map((loop, index) => (
                                <div
                                  key={`${loop}-${index}`}
                                  className="flex items-start gap-3 rounded-[14px] border border-[rgba(168,85,247,0.12)] bg-[rgba(168,85,247,0.04)] px-3 py-2.5"
                                >
                                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--accent-purple)]" />
                                  <p className="text-[13px] leading-6 text-[rgba(226,232,240,0.82)]">
                                    {loop}
                                  </p>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </article>

                        {messages.map((message, index) =>
                          message.role === "user" ? (
                            <div
                              key={message.id}
                              className="animate-chat-entry mono-copy border-l border-[rgba(168,85,247,0.32)] pl-4 text-[13px] text-[var(--text-primary)]"
                            >
                              <div className="mb-1 flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
                                <span>{formatTime(message.createdAt)}</span>
                                <span>user.prompt</span>
                              </div>
                              <p className="whitespace-pre-wrap leading-7">
                                <span className="mr-2 text-[var(--accent-purple)]">&gt;</span>
                                {message.content}
                              </p>
                            </div>
                          ) : (
                            <article
                              key={message.id}
                              className="animate-chat-entry pixel-frame depth-panel relative overflow-hidden rounded-[20px] pl-4"
                            >
                              <span className="absolute inset-y-0 left-0 w-[3px] bg-[var(--accent-purple)]" />
                              <div className="p-4">
                                <div className="mb-3 flex items-center justify-between gap-3 border-b border-[var(--border-default)] pb-3">
                                  <span
                                    className="text-[11px] uppercase tracking-[0.2em] text-[var(--accent-purple)]"
                                    style={{ fontFamily: "var(--font-pixel)" }}
                                  >
                                    pixy.voice
                                  </span>
                                  <span className="text-[12px] text-[var(--text-muted)]">
                                    {formatTime(message.createdAt)} / #{index + 1}
                                  </span>
                                </div>
                                <MarkdownBlock content={message.content} />
                                {message.id === latestAssistantId ? (
                                  <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--border-default)] pt-3">
                                    <span className="rounded-full border border-[rgba(168,85,247,0.18)] bg-[rgba(168,85,247,0.08)] px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-[var(--accent-purple)]">
                                      session {shortSessionLabel(sessionId)}
                                    </span>
                                    {(message.memoryEvidence?.length ? message.memoryEvidence : memorySignals)
                                      .slice(0, 2)
                                      .map((signal) => (
                                      <span
                                        key={signal}
                                        className="rounded-full border border-[rgba(34,197,94,0.18)] bg-[rgba(34,197,94,0.08)] px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-[var(--accent-green)]"
                                      >
                                        memory {summarizeText(signal, 28)}
                                      </span>
                                    ))}
                                    <span className="rounded-full border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)] px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
                                      state {agentState}
                                    </span>
                                    {message.skillInvocation ? (
                                      <span className="rounded-full border border-[rgba(245,158,11,0.22)] bg-[rgba(245,158,11,0.08)] px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-[var(--accent-amber)]">
                                        skill {message.skillInvocation.label}
                                      </span>
                                    ) : null}
                                  </div>
                                ) : null}
                              </div>
                            </article>
                          ),
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="px-5 py-4">
                  {warnings.length > 0 ? (
                    <div className="mb-3 rounded-lg border border-[rgba(245,158,11,0.22)] bg-[rgba(245,158,11,0.08)] px-4 py-3 text-sm text-[var(--accent-amber)]">
                      {warnings.join(" ")}
                    </div>
                  ) : null}
                  {error ? (
                    <div className="mb-3 rounded-lg border border-[rgba(239,68,68,0.22)] bg-[rgba(239,68,68,0.08)] px-4 py-3 text-sm text-[var(--accent-red)]">
                      {error}
                    </div>
                  ) : null}

                  <form
                    ref={formRef}
                    onSubmit={handleSubmit}
                    className="pixel-frame depth-panel rounded-[20px] p-3"
                  >
                    <div className="flex items-end gap-3">
                      <span
                        className="pb-3 text-[16px] uppercase tracking-[0.12em] text-[var(--accent-purple)]"
                        style={{ fontFamily: "var(--font-pixel)" }}
                      >
                        $
                      </span>
                      <textarea
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            formRef.current?.requestSubmit();
                          }
                        }}
                        rows={3}
                        placeholder=""
                        className="min-h-[76px] flex-1 resize-none bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
                      />
                      <button
                        type="submit"
                        disabled={isSending || !draft.trim()}
                        className="mb-1 inline-flex h-10 items-center gap-2 rounded-lg border border-[rgba(168,85,247,0.28)] bg-[rgba(168,85,247,0.92)] px-4 text-sm font-semibold text-black transition-all duration-150 hover:brightness-110 disabled:cursor-not-allowed disabled:border-[var(--border-default)] disabled:bg-[var(--bg-surface)] disabled:text-[var(--text-muted)]"
                      >
                        <span
                          className="text-[11px] uppercase tracking-[0.18em]"
                          style={{ fontFamily: "var(--font-pixel)" }}
                        >
                          send
                        </span>
                        <span>{isSending || isPending ? "..." : "↑"}</span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            ) : null}
          </section>

          {showDock ? (
            <section className="grid grid-cols-[1.25fr_0.9fr_0.85fr] gap-4">
              <article className="pixel-frame depth-panel flex h-full flex-col rounded-[22px] px-5 py-4">
                <div>
                  <span
                    className="text-[14px] uppercase tracking-[0.18em] text-[var(--accent-purple)]"
                    style={{ fontFamily: "var(--font-pixel)" }}
                  >
                    thread continuity
                  </span>
                  <p className="mt-6 text-[64px] leading-none text-[rgba(196,181,253,0.95)]">
                    {continuityMetricValue}
                  </p>
                  <p
                    className="mt-3 text-[10px] uppercase tracking-[0.18em] text-[var(--accent-purple)]"
                    style={{ fontFamily: "var(--font-pixel)" }}
                  >
                    messages
                  </p>
                </div>
                <div className="mt-auto grid grid-cols-3 gap-3 pt-8 text-[12px] text-[var(--text-muted)]">
                  <div className="rounded-[16px] border border-[rgba(168,85,247,0.14)] bg-[rgba(168,85,247,0.05)] px-3 py-3">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--accent-purple)]">
                      resumed
                    </p>
                    <p className="mt-2 text-[12px] leading-5 text-[var(--text-primary)]">
                      {continuityTitle}
                    </p>
                  </div>
                  <div className="rounded-[16px] border border-[rgba(168,85,247,0.14)] bg-[rgba(168,85,247,0.05)] px-3 py-3">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--accent-purple)]">
                      last sync
                    </p>
                    <p className="mt-2 text-[12px] leading-5 text-[var(--text-primary)]">
                      {formatTime(continuityLastSyncAt)}
                    </p>
                  </div>
                  <div className="rounded-[16px] border border-[rgba(168,85,247,0.14)] bg-[rgba(168,85,247,0.05)] px-3 py-3">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--accent-purple)]">
                      open loops
                    </p>
                    <p className="mt-2 text-[12px] leading-5 text-[var(--text-primary)]">
                      {continuityOpenLoops.length}
                    </p>
                  </div>
                </div>
              </article>

              <article className="pixel-frame flex h-full flex-col rounded-[22px] border-[rgba(255,255,255,0.08)] bg-[linear-gradient(180deg,rgba(24,27,34,0.94),rgba(18,20,27,0.98))] px-5 py-4 shadow-[0_20px_44px_rgba(0,0,0,0.3)]">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <RuntimePulseIcon />
                    <span
                      className="text-[14px] uppercase tracking-[0.18em] text-[var(--accent-purple)]"
                      style={{ fontFamily: "var(--font-pixel)" }}
                    >
                      STATE TRACE
                    </span>
                  </div>
                </div>
                <div className="mt-6 space-y-5">
                  <div className="rounded-[16px] border border-[rgba(168,85,247,0.14)] bg-[rgba(168,85,247,0.05)] px-4 py-3">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--accent-purple)]">
                      live state
                    </p>
                    <p className="mt-2 text-[15px] text-[var(--text-primary)]">{agentState}</p>
                    <p className="mt-1 text-[12px] text-[var(--text-muted)]">
                      runtime {health?.runtime_mode ?? "link-pending"}
                    </p>
                  </div>
                  {stateTrace.map((step) => (
                    <div key={step.key} className="flex items-center justify-between gap-4 py-1">
                      <span className="text-[16px] tracking-[0.02em] text-[var(--text-muted)]">
                        {step.label}
                      </span>
                      <span
                        className={`text-[12px] font-semibold uppercase tracking-[0.16em] ${
                          step.status === "done"
                            ? "text-[var(--accent-green)]"
                            : step.status === "active"
                              ? "text-[var(--accent-amber)]"
                              : "text-[var(--text-primary)]"
                        }`}
                      >
                        {step.status}
                      </span>
                    </div>
                  ))}
                </div>
              </article>

              <article className="pixel-frame flex h-full flex-col rounded-[22px] border-[rgba(255,255,255,0.08)] bg-[linear-gradient(180deg,rgba(24,27,34,0.94),rgba(18,20,27,0.98))] px-5 py-4 shadow-[0_20px_44px_rgba(0,0,0,0.3)]">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <MemoryLayerIcon />
                    <span
                      className="text-[14px] uppercase tracking-[0.18em] text-[var(--accent-purple)]"
                      style={{ fontFamily: "var(--font-pixel)" }}
                    >
                      MEMORY LEDGER
                    </span>
                  </div>
                </div>
                <div className="mt-5 space-y-3">
                  <div className="rounded-[1rem] border border-[rgba(168,85,247,0.14)] bg-[rgba(168,85,247,0.05)] px-4 py-4">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--accent-purple)]">
                      stable profile
                    </p>
                    <div className="mt-3 flex items-start gap-4">
                      <span className="mt-2 h-3 w-3 shrink-0 rounded-full bg-[var(--accent-purple)]" />
                      <p className="text-[15px] leading-8 text-[rgba(226,232,240,0.74)]">
                        {memorySignals[0] ?? "No durable user profile has been written yet."}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-[1rem] border border-[rgba(34,197,94,0.14)] bg-[rgba(34,197,94,0.05)] px-4 py-4">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--accent-green)]">
                      recent learning
                    </p>
                    <p className="mt-3 text-[14px] leading-7 text-[rgba(226,232,240,0.74)]">
                      {recentLearning}
                    </p>
                  </div>
                  <div className="rounded-[1rem] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-4 py-4">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                      active focus
                    </p>
                    <p className="mt-3 text-[14px] leading-7 text-[rgba(226,232,240,0.74)]">
                      {activeFocus}
                    </p>
                    {activeSession?.path ? (
                      <p className="mt-2 text-[11px] text-[var(--text-muted)]">
                        source {activeSession.path}
                      </p>
                    ) : null}
                  </div>
                  <div className="rounded-[1rem] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-4 py-3">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                      session source
                    </p>
                    <p className="mt-2 text-[13px] leading-6 text-[rgba(226,232,240,0.74)]">
                      {sessions?.source ?? "Session index not loaded yet."}
                    </p>
                    {memory?.path ? (
                      <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                        memory {memory.path}
                      </p>
                    ) : null}
                  </div>
                </div>
              </article>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
