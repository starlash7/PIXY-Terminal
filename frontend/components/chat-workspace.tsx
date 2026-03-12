"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { MarkdownBlock } from "@/components/markdown-block";
import { getJson, postJson } from "@/lib/client";
import type { ChatResponse, HealthResponse } from "@/lib/types";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
};

type AvatarMood = "idle" | "thinking" | "smile" | "caution" | "glitch";
type WindowMode = "windowed" | "maximized" | "minimized";

const MOOD_COPY: Record<AvatarMood, string> = {
  idle: "link stable. waiting for the next prompt.",
  thinking: "thinking through memory, tools, and recent turns.",
  smile: "response ready. keeping the thread alive.",
  caution: "simulator path active. replies may be mocked.",
  glitch: "signal noise detected. inspect health or retry.",
};

async function loadHealth(): Promise<HealthResponse> {
  return getJson<HealthResponse>("/api/health");
}

function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(timestamp));
}

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes.toString().padStart(2, "0")}m ${seconds.toString().padStart(2, "0")}s`;
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
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [windowMode, setWindowMode] = useState<WindowMode>("windowed");
  const [isPending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  async function refreshHealth() {
    const healthData = await loadHealth();
    setHealth(healthData);
  }

  useEffect(() => {
    void refreshHealth().catch(() => {
      setHealth(null);
    });
  }, []);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) {
      return;
    }

    container.scrollTop = container.scrollHeight;
  }, [messages, isSending]);

  const simulatorMode = health?.runtime_mode === "simulator";

  const mood: AvatarMood = useMemo(() => {
    if (error) {
      return "glitch";
    }
    if (isSending || isPending) {
      return "thinking";
    }
    if (simulatorMode || warnings.length > 0) {
      return "caution";
    }
    if (messages.length > 1) {
      return "smile";
    }
    return "idle";
  }, [error, isSending, isPending, simulatorMode, warnings.length, messages.length]);

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
            createdAt: Date.now(),
          },
        ]);
        setSessionId(response.session_id);
        setWarnings(response.warnings);
      });

      void refreshHealth().catch(() => {
        setHealth(null);
      });
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
    } finally {
      setIsSending(false);
    }
  }

  const startedAt = messages[0]?.createdAt ?? Date.now();
  const lastEventAt = messages[messages.length - 1]?.createdAt ?? startedAt;
  const conversationDuration = formatDuration(lastEventAt - startedAt);
  const showWindowBody = windowMode !== "minimized";
  const showDock = windowMode === "windowed";
  const pagePaddingClass =
    windowMode === "maximized" ? "px-0 py-0" : "px-6 py-6";
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
              </div>
            </div>

            {showWindowBody ? (
              <div className="relative flex h-[calc(100%-57px)] flex-col">
              <div className="relative min-h-0 flex-1 overflow-hidden">
                <div className="pointer-events-none absolute bottom-0 right-8 z-10 w-[20rem]">
                  <div className="depth-tilt relative h-[25rem]">
                    <div className="core-frame absolute bottom-2 right-0 h-[18rem] w-[18rem]">
                      <Image
                        src="/api/character-image"
                        alt="Pixy portrait"
                        width={512}
                        height={512}
                        priority
                        unoptimized
                        className="relative z-10 h-full w-full select-none object-cover object-center"
                      />
                    </div>
                  </div>
                </div>

                <div ref={scrollRef} className="relative z-0 h-full overflow-y-auto">
                  <div className="max-w-[780px] space-y-4 px-6 py-6 pb-10">
                    <div className="pixel-frame depth-panel rounded-[18px] border-[rgba(168,85,247,0.18)] px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <span
                          className="text-[11px] uppercase tracking-[0.18em] text-[var(--accent-purple)]"
                          style={{ fontFamily: "var(--font-pixel)" }}
                        >
                          pixy.presence
                        </span>
                        <span className="text-[12px] text-[var(--text-muted)]">
                          {MOOD_COPY[mood]}
                        </span>
                      </div>
                    </div>

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
                          </div>
                        </article>
                      ),
                    )}
                  </div>
                </div>
              </div>

              <div className="border-t border-[var(--border-default)] px-5 py-4">
                {simulatorMode ? (
                  <div className="mb-3 rounded-lg border border-[rgba(245,158,11,0.22)] bg-[rgba(245,158,11,0.08)] px-4 py-3 text-sm text-[var(--accent-amber)]">
                    ⚠ Simulator mode — responses are mocked
                  </div>
                ) : null}
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

                <form ref={formRef} onSubmit={handleSubmit} className="pixel-frame depth-panel rounded-[20px] p-3">
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
                  talk time
                </span>
                <p
                  className="mt-6 text-[64px] leading-none text-[rgba(196,181,253,0.95)]"
                  style={{ fontFamily: "var(--font-pixel)" }}
                >
                  {conversationDuration}
                </p>
              </div>
              <div className="mt-auto grid grid-cols-3 gap-3 pt-8 text-[12px] text-[var(--text-muted)]">
                <div className="rounded-[16px] border border-[rgba(168,85,247,0.14)] bg-[rgba(168,85,247,0.05)] px-3 py-3">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--accent-purple)]">
                    started
                  </p>
                  <p className="mt-2 text-[var(--text-primary)]">{formatTime(startedAt)}</p>
                </div>
                <div className="rounded-[16px] border border-[rgba(168,85,247,0.14)] bg-[rgba(168,85,247,0.05)] px-3 py-3">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--accent-purple)]">
                    last log
                  </p>
                  <p className="mt-2 text-[var(--text-primary)]">{formatTime(lastEventAt)}</p>
                </div>
                <div className="rounded-[16px] border border-[rgba(168,85,247,0.14)] bg-[rgba(168,85,247,0.05)] px-3 py-3">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--accent-purple)]">
                    logs
                  </p>
                  <p className="mt-2 text-[var(--text-primary)]">{messages.length}</p>
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
                    {"RUNTIME"}
                  </span>
                </div>
              </div>
              <div className="mt-6 space-y-5">
                <div className="flex items-center justify-between gap-4 py-1">
                  <span className="text-[16px] tracking-[0.02em] text-[var(--text-muted)]">
                    Inference latency
                  </span>
                  <span className="text-[15px] font-semibold text-[var(--accent-green)]">
                    340ms
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 py-1">
                  <span className="text-[16px] tracking-[0.02em] text-[var(--text-muted)]">
                    Context usage
                  </span>
                  <span className="text-[15px] font-semibold text-[var(--accent-amber)]">
                    78%
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 py-1">
                  <span className="text-[16px] tracking-[0.02em] text-[var(--text-muted)]">
                    Active threads
                  </span>
                  <span className="text-[15px] font-semibold text-[var(--text-primary)]">
                    14
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 py-1">
                  <span className="text-[16px] tracking-[0.02em] text-[var(--text-muted)]">
                    Memory heap
                  </span>
                  <span className="text-[15px] font-semibold text-[var(--text-primary)]">
                    6.2 / 16 GB
                  </span>
                </div>
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
                    {"MEMORY"}
                  </span>
                </div>
              </div>
              <div className="mt-5">
                <div className="rounded-[1rem] border border-[rgba(168,85,247,0.14)] bg-[rgba(168,85,247,0.05)] px-4 py-4">
                  <div className="flex items-start gap-4">
                    <span className="mt-2 h-3 w-3 shrink-0 rounded-full bg-[var(--accent-purple)]" />
                    <p className="text-[15px] leading-8 text-[rgba(226,232,240,0.74)]">
                      User prefers concise diagnostic format with bullet summaries and explicit
                      numeric thresholds.
                    </p>
                  </div>
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
