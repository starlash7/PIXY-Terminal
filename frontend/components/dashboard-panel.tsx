"use client";

import { useEffect, useEffectEvent, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { getJson } from "@/lib/client";
import type {
  HealthResponse,
  MemoryResponse,
  SessionsResponse,
  SkillsResponse,
} from "@/lib/types";

function statCards(data: {
  skills: number;
  sessions: number;
  memoryWords: number;
  liveMode: string;
}) {
  return [
    {
      label: "Skills tracked",
      value: data.skills.toString(),
      copy: "Visible cards from ~/.hermes/skills.",
    },
    {
      label: "Session logs",
      value: data.sessions.toString(),
      copy: "Recent conversations preserved for review.",
    },
    {
      label: "Memory size",
      value: `${data.memoryWords}w`,
      copy: "Short-term profile rendered from MEMORY.md.",
    },
    {
      label: "Runtime",
      value: data.liveMode,
      copy: "Python API가 아니어도 CLI fallback으로 live 상태를 유지합니다.",
    },
  ];
}

export function DashboardPanel() {
  const [skills, setSkills] = useState<SkillsResponse | null>(null);
  const [sessions, setSessions] = useState<SessionsResponse | null>(null);
  const [memory, setMemory] = useState<MemoryResponse | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useEffectEvent(async () => {
    const [skillsData, sessionsData, memoryData, healthData] = await Promise.all([
      getJson<SkillsResponse>("/api/skills"),
      getJson<SessionsResponse>("/api/sessions"),
      getJson<MemoryResponse>("/api/memory"),
      getJson<HealthResponse>("/api/health"),
    ]);

    setSkills(skillsData);
    setSessions(sessionsData);
    setMemory(memoryData);
    setHealth(healthData);
  });

  useEffect(() => {
    void refresh().catch((refreshError) => {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "Failed to load dashboard metrics.",
      );
    });
  }, []);

  const cards = statCards({
    skills: skills?.skills.length ?? 0,
    sessions: sessions?.sessions.length ?? 0,
    memoryWords: memory?.content.split(/\s+/).filter(Boolean).length ?? 0,
    liveMode:
      health?.runtime_mode === "python_api"
        ? "Hermes API"
        : health?.runtime_mode === "cli"
          ? "Hermes CLI"
          : "Simulator",
  });

  return (
    <AppShell
      title="The visibility layer for a self-improving agent."
      description="This view turns hidden local state into demo-ready metrics: skills, memory density, recent sessions, and whether the runtime is live or simulated."
      accentLabel="Overview"
    >
      <div className="space-y-4">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <article key={card.label} className="glass-panel rounded-[1.5rem] p-4">
              <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted)]">
                {card.label}
              </p>
              <p className="mt-4 text-4xl font-semibold tracking-tight text-white">
                {card.value}
              </p>
              <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{card.copy}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
          <article className="glass-panel rounded-[1.75rem] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted)]">
                  Demo script anchors
                </p>
                <h2 className="mt-3 text-2xl font-semibold text-white">
                  What to show in the 2-minute walkthrough.
                </h2>
              </div>
              <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-[var(--muted)]">
                Anywhere access
              </span>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {[
                "Start in chat and show the CLI-friendly prompt rendered in a calm UI.",
                "Flip to skills and show each learned workflow as a card, not a file path.",
                "Open the memory panel to prove the assistant retains personal context.",
                "Resize to mobile and show the same state working from a phone browser.",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-[1.25rem] border border-white/8 bg-black/20 p-4 text-sm leading-7 text-white/90"
                >
                  {item}
                </div>
              ))}
            </div>
          </article>

          <article className="glass-panel rounded-[1.75rem] p-5">
            <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted)]">
              Memory excerpt
            </p>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-white/90">
              {memory?.content.slice(0, 620) || "No persisted memory file yet."}
            </p>
          </article>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <article className="glass-panel rounded-[1.75rem] p-5">
            <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted)]">
              Recent sessions
            </p>
            <div className="mt-4 space-y-3">
              {sessions?.sessions.length ? (
                sessions.sessions.slice(0, 5).map((session) => (
                  <div
                    key={session.id}
                    className="rounded-[1.2rem] border border-white/8 bg-black/20 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-white">{session.title}</p>
                      <span className="text-xs text-[var(--muted)]">
                        {session.message_count} messages
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                      {session.preview}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm leading-7 text-[var(--muted)]">
                  No session logs have been written yet.
                </p>
              )}
            </div>
          </article>

          <article className="glass-panel rounded-[1.75rem] p-5">
            <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted)]">
              Runtime notes
            </p>
            <div className="mt-4 space-y-3 text-sm leading-7 text-white/90">
              <p>Hermes home: {health?.hermes_home ?? "Unknown"}</p>
              <p>Runtime mode: {health?.runtime_mode ?? "Unknown"}</p>
              <p>Memory file: {health?.memory_path ?? "Not found"}</p>
              <p>Skills source: {skills?.source ?? "Unknown"}</p>
              <p>Sessions source: {sessions?.source ?? "Unknown"}</p>
              {health?.issues.map((issue) => <p key={issue}>{issue}</p>)}
              {error ? <p className="text-[var(--danger)]">{error}</p> : null}
            </div>
          </article>
        </section>
      </div>
    </AppShell>
  );
}
