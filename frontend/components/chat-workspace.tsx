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

const ASCII_FRAMES: Record<AvatarMood, string> = {
  idle: String.raw`[idle]  (\^_^/)  sync ok`,
  thinking: String.raw`[think] ( -_-)   indexing...`,
  smile: String.raw`[reply] (\^_^/)  live`,
  caution: String.raw`[warn]  ( o_o )  simulator`,
  glitch: String.raw`[error] ( x_x )  retry`,
};

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

function truncateLine(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1)}…`;
}

function latestAssistantLine(messages: Message[]): string | null {
  const assistantMessage = [...messages].reverse().find((message) => message.role === "assistant");
  if (!assistantMessage) {
    return null;
  }

  return assistantMessage.content.split("\n").find(Boolean) ?? assistantMessage.content;
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
  const connected = Boolean(health?.hermes_available && !simulatorMode);

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

  const assistantLine = latestAssistantLine(messages);
  const bubbleCopy = truncateLine(
    isSending || isPending ? MOOD_COPY.thinking : assistantLine ?? MOOD_COPY[mood],
    72,
  );
  const activeFrame = ASCII_FRAMES[mood];

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
      ? "h-screen"
      : windowMode === "minimized"
        ? "h-[3.75rem]"
        : "h-[42rem]";
  const stageShapeClass =
    windowMode === "maximized"
      ? "rounded-none border-x-0 border-y-0"
      : "rounded-[28px]";

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg-primary)]">
      <div className={`min-h-0 flex-1 ${pagePaddingClass}`}>
        <div className={`mx-auto flex h-full ${containerWidthClass} flex-col gap-4`}>
          <section
            className={`cyber-stage terminal-grid terminal-scanlines pixel-frame shader-shell flex-none ${stageShapeClass} ${stageHeightClass}`}
          >
            <div className="flex items-center justify-between border-b border-[var(--border-default)] px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Minimize window"
                    onClick={() => setWindowMode("minimized")}
                    className="inline-flex h-3 w-3 items-center justify-center rounded-full bg-[#fb5f57] text-[8px] font-bold text-black transition-transform duration-150 hover:scale-110"
                  >
                    -
                  </button>
                  <button
                    type="button"
                    aria-label="Window mode"
                    onClick={() => setWindowMode("windowed")}
                    className="inline-flex h-3 w-3 items-center justify-center rounded-full bg-[#febc2e] text-[7px] font-bold text-black transition-transform duration-150 hover:scale-110"
                  >
                    □
                  </button>
                  <button
                    type="button"
                    aria-label="Maximize window"
                    onClick={() => setWindowMode("maximized")}
                    className="inline-flex h-3 w-3 items-center justify-center rounded-full bg-[var(--accent-purple)] text-[8px] font-bold text-black transition-transform duration-150 hover:scale-110"
                  >
                    +
                  </button>
                </div>
                <span className="font-mono text-[12px] text-[var(--text-muted)]">~/pixy/chat</span>
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
                  <div className="depth-panel absolute -left-44 top-8 w-80 overflow-visible rounded-[24px] px-5 py-4 backdrop-blur">
                    <span
                      className="text-[10px] uppercase tracking-[0.18em] text-[var(--accent-purple)]"
                      style={{ fontFamily: "var(--font-pixel)" }}
                    >
                      pixy.core
                    </span>
                    <p className="mt-2 text-sm leading-6 text-[var(--text-primary)]">{bubbleCopy}</p>
                    <span className="absolute -bottom-1 left-12 h-3 w-3 rotate-45 border-r border-b border-[rgba(168,85,247,0.24)] bg-[rgba(10,10,10,0.82)]" />
                  </div>

                  <div className="depth-panel absolute left-3 top-36 rounded-[18px] px-3 py-3 backdrop-blur">
                    <p className="mb-2 text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                      conversation partner
                    </p>
                    <pre className="ascii-signal mono-copy whitespace-pre text-[10px] leading-5 text-[rgba(148,163,184,0.92)]">
                      {activeFrame}
                    </pre>
                  </div>

                  <div className="depth-tilt relative h-[25rem]">
                    <div className="absolute bottom-10 right-10 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(168,85,247,0.34),transparent_66%)] blur-3xl" />
                    <div className="absolute bottom-16 right-14 h-36 w-36 rounded-full border border-[rgba(168,85,247,0.18)]" />
                    <div className="core-frame absolute bottom-2 right-0 h-[18rem] w-[18rem]">
                      <div className="absolute inset-[10%] rounded-full border border-[rgba(255,255,255,0.08)]" />
                      <Image
                        src="/api/character-image"
                        alt="Pixy portrait"
                        width={512}
                        height={512}
                        priority
                        unoptimized
                        className="relative z-10 h-full w-full select-none object-cover object-center"
                      />
                      <div className="absolute inset-0 z-20 rounded-full bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.18),transparent_28%),radial-gradient(circle_at_bottom,rgba(168,85,247,0.18),transparent_40%)]" />
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
                        <span className="font-mono text-[12px] text-[var(--text-muted)]">
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
                              <span className="font-mono text-[12px] text-[var(--text-muted)]">
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
                  <div className="flex items-start gap-3">
                    <span
                      className="pt-3 text-[12px] uppercase tracking-[0.16em] text-[var(--accent-purple)]"
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
                      className="min-h-[76px] flex-1 resize-none bg-transparent font-mono text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
                    />
                    <button
                      type="submit"
                      disabled={isSending || !draft.trim()}
                      className="inline-flex h-10 items-center gap-2 rounded-lg border border-[rgba(168,85,247,0.28)] bg-[rgba(168,85,247,0.92)] px-4 text-sm font-semibold text-black transition-all duration-150 hover:brightness-110 disabled:cursor-not-allowed disabled:border-[var(--border-default)] disabled:bg-[var(--bg-surface)] disabled:text-[var(--text-muted)]"
                    >
                      <span
                        className="text-[11px] uppercase tracking-[0.18em]"
                        style={{ fontFamily: "var(--font-pixel)" }}
                      >
                        send
                      </span>
                      <span className="font-mono">{isSending || isPending ? "..." : "↑"}</span>
                    </button>
                  </div>
                </form>
              </div>
              </div>
            ) : null}
          </section>

          {showDock ? (
            <section className="grid grid-cols-[1.25fr_0.9fr_0.85fr] gap-4">
            <article className="pixel-frame depth-panel rounded-[22px] px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <span
                  className="text-[11px] uppercase tracking-[0.2em] text-[var(--accent-purple)]"
                  style={{ fontFamily: "var(--font-pixel)" }}
                >
                  talk time
                </span>
                <span className="font-mono text-[12px] text-[var(--text-muted)]">total session</span>
              </div>
              <div className="mt-5">
                <p
                  className="text-[46px] leading-none text-[rgba(196,181,253,0.95)]"
                  style={{ fontFamily: "var(--font-pixel)" }}
                >
                  {conversationDuration}
                </p>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-3 font-mono text-[12px] text-[var(--text-muted)]">
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

            <article className="pixel-frame depth-panel rounded-[22px] px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <span
                  className="text-[11px] uppercase tracking-[0.2em] text-[var(--accent-purple)]"
                  style={{ fontFamily: "var(--font-pixel)" }}
                >
                  status window
                </span>
                <span className="font-mono text-[12px] text-[var(--text-muted)]">{mood}</span>
              </div>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[var(--text-muted)]">Hermes link</span>
                  <span className={connected ? "text-[rgba(196,181,253,0.95)]" : "text-[var(--accent-red)]"}>
                    {connected ? "online" : "offline"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[var(--text-muted)]">Runtime</span>
                  <span className={simulatorMode ? "text-[var(--accent-amber)]" : "text-[var(--text-primary)]"}>
                    {simulatorMode ? "simulator" : "live"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[var(--text-muted)]">Warnings</span>
                  <span className="font-mono text-[var(--text-primary)]">{warnings.length}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[var(--text-muted)]">Session</span>
                  <span className="font-mono text-[var(--text-primary)]">{sessionId ?? "new-session"}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[var(--text-muted)]">Memory</span>
                  <span className="text-[rgba(196,181,253,0.95)]">mounted</span>
                </div>
              </div>
            </article>

            <article className="pixel-frame depth-panel rounded-[22px] px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <span
                  className="text-[11px] uppercase tracking-[0.2em] text-[var(--accent-purple)]"
                  style={{ fontFamily: "var(--font-pixel)" }}
                >
                  add-on bay
                </span>
                <span className="font-mono text-[12px] text-[var(--text-muted)]">live hooks</span>
              </div>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[var(--text-muted)]">skill.invoke</span>
                  <span className="text-[rgba(196,181,253,0.95)]">armed</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[var(--text-muted)]">memory.write</span>
                  <span className="text-[rgba(196,181,253,0.95)]">ready</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[var(--text-muted)]">session.resume</span>
                  <span className={sessionId ? "text-[rgba(196,181,253,0.95)]" : "text-[var(--text-muted)]"}>
                    {sessionId ? "active" : "standby"}
                  </span>
                </div>
              </div>
              <div className="mt-4 border-t border-[var(--border-default)] pt-3">
                <p className="font-mono text-[12px] leading-6 text-[var(--text-muted)]">
                  current.mood::{mood}
                </p>
              </div>
            </article>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
