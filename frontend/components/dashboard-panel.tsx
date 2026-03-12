"use client";

import { useEffect, useEffectEvent, useState } from "react";

import { getJson } from "@/lib/client";
import type {
  MemoryResponse,
  SessionsResponse,
  SkillsResponse,
} from "@/lib/types";

function countWords(content: string): number {
  return content.split(/\s+/).filter(Boolean).length;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function DashboardPanel() {
  const [skills, setSkills] = useState<SkillsResponse | null>(null);
  const [sessions, setSessions] = useState<SessionsResponse | null>(null);
  const [memory, setMemory] = useState<MemoryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useEffectEvent(async () => {
    const [skillsData, sessionsData, memoryData] = await Promise.all([
      getJson<SkillsResponse>("/api/skills"),
      getJson<SessionsResponse>("/api/sessions"),
      getJson<MemoryResponse>("/api/memory"),
    ]);

    setSkills(skillsData);
    setSessions(sessionsData);
    setMemory(memoryData);
  });

  useEffect(() => {
    void refresh().catch((refreshError) => {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "Failed to load dashboard data.",
      );
    });
  }, []);

  const statCards = [
    {
      label: "Sessions",
      value: (sessions?.sessions.length ?? 0).toString(),
      detail: "Saved conversation logs",
    },
    {
      label: "Skills",
      value: (skills?.skills.length ?? 0).toString(),
      detail: "Active Hermes skills",
    },
    {
      label: "Memory",
      value: memory?.path ? "Ready" : "Missing",
      detail: memory?.path
        ? `${countWords(memory.content)} words in MEMORY.md`
        : "No memory file",
    },
  ];

  return (
    <div
      className="flex h-[calc(100vh-3rem)] flex-col"
      style={{ fontFamily: "var(--font-pixel)" }}
    >
      <div className="border-b border-[var(--border-default)] px-6 py-4">
        <h1 className="text-[20px] font-semibold text-[var(--accent-amber)]">DASHBOARD</h1>
        <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
          Sessions, skills, and memory in one overview.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
        <div className="space-y-6">
          {error ? (
            <div className="rounded-xl border border-[rgba(239,68,68,0.22)] bg-[rgba(239,68,68,0.08)] px-4 py-3 text-sm text-[var(--accent-red)]">
              {error}
            </div>
          ) : null}

          <section className="grid grid-cols-3 gap-4">
            {statCards.map((card) => (
              <article
                key={card.label}
                className="pixel-frame depth-panel rounded-[22px] p-5 transition-all duration-150"
              >
                <p className="text-[13px] uppercase tracking-[0.16em] text-[var(--accent-purple)]">
                  {card.label}
                </p>
                <p className="mt-5 text-[42px] leading-none text-[rgba(196,181,253,0.95)]">
                  {card.value}
                </p>
                <p className="mt-4 text-sm leading-7 text-[var(--text-muted)]">{card.detail}</p>
              </article>
            ))}
          </section>

          <section className="pixel-frame depth-panel overflow-hidden rounded-[22px]">
            <div className="flex items-center justify-between border-b border-[var(--border-default)] px-5 py-4">
              <h2 className="text-[14px] uppercase tracking-[0.18em] text-[var(--accent-purple)]">
                RECENT SESSIONS
              </h2>
              <span className="text-xs text-[var(--text-muted)]">
                {(sessions?.sessions.length ?? 0).toString()} tracked
              </span>
            </div>
            <div>
              {sessions?.sessions.length ? (
                sessions.sessions.slice(0, 8).map((session) => (
                  <a
                    key={session.id}
                    href="/chat"
                    className="flex items-center justify-between gap-4 border-b border-[var(--border-default)] px-5 py-4 transition-all duration-150 last:border-b-0 hover:bg-[rgba(168,85,247,0.08)]"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-[var(--accent-purple)]">
                        {session.id}
                      </p>
                      <p className="mt-1 truncate text-sm text-[var(--text-primary)]">
                        {session.title}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs text-[var(--text-muted)]">
                        {formatDate(session.last_updated)}
                      </p>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">
                        {session.message_count} messages
                      </p>
                    </div>
                  </a>
                ))
              ) : (
                <p className="px-5 py-6 text-sm text-[var(--text-muted)]">
                  No sessions found yet.
                </p>
              )}
            </div>
          </section>

          <section id="memory-preview" className="pixel-frame depth-panel rounded-[22px]">
            <div className="flex items-center justify-between border-b border-[var(--border-default)] px-5 py-4">
              <h2 className="text-[14px] uppercase tracking-[0.18em] text-[var(--accent-purple)]">
                MEMORY PREVIEW
              </h2>
              <span className="text-xs text-[var(--text-muted)]">
                {memory?.path ?? "MEMORY.md unavailable"}
              </span>
            </div>
            <div className="max-h-48 overflow-y-auto px-5 py-4">
              <pre className="whitespace-pre-wrap text-[14px] leading-7 text-[var(--text-primary)]">
                {memory?.content || "No MEMORY.md content available."}
              </pre>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
