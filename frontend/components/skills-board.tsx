"use client";

import { useDeferredValue, useEffect, useEffectEvent, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { getJson } from "@/lib/client";
import type { MemoryResponse, SessionCard, SessionsResponse, SkillCard, SkillsResponse } from "@/lib/types";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function SkillsBoard() {
  const [skills, setSkills] = useState<SkillCard[]>([]);
  const [sessions, setSessions] = useState<SessionCard[]>([]);
  const [memory, setMemory] = useState<MemoryResponse | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(query);

  const refresh = useEffectEvent(async () => {
    const [skillsData, sessionsData, memoryData] = await Promise.all([
      getJson<SkillsResponse>("/api/skills"),
      getJson<SessionsResponse>("/api/sessions"),
      getJson<MemoryResponse>("/api/memory"),
    ]);
    setSkills(skillsData.skills);
    setSessions(sessionsData.sessions.slice(0, 3));
    setMemory(memoryData);
  });

  useEffect(() => {
    void refresh().catch((refreshError) => {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "Failed to load skills from Hermes storage.",
      );
    });
  }, []);

  const filteredSkills = skills.filter((skill) => {
    const haystack = `${skill.title} ${skill.summary}`.toLowerCase();
    return haystack.includes(deferredQuery.toLowerCase());
  });

  return (
    <AppShell
      title="Every learned workflow gets its own surface area."
      description="Skills stay inspectable here instead of disappearing into markdown files. Search stays responsive even as the card list grows."
      accentLabel="Skill library"
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.85fr)]">
        <section className="glass-panel rounded-[1.75rem] p-4 sm:p-5">
          <div className="flex flex-col gap-4 border-b border-white/6 pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted)]">
                Skills
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-white">
                Searchable growth log
              </h2>
            </div>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search summaries or titles"
              className="w-full rounded-full border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--glow)] sm:max-w-xs"
            />
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {filteredSkills.length > 0 ? (
              filteredSkills.map((skill) => (
                <article
                  key={skill.id}
                  className="rounded-[1.4rem] border border-white/8 bg-black/20 p-4 transition hover:border-[var(--line)] hover:bg-black/28"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-white">{skill.title}</p>
                      <p className="mt-2 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                        {skill.id}
                      </p>
                    </div>
                    <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-[var(--muted)]">
                      {formatDate(skill.last_updated)}
                    </span>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
                    {skill.summary}
                  </p>
                  <p className="mt-4 text-xs leading-6 text-white/60">{skill.path}</p>
                </article>
              ))
            ) : (
              <div className="rounded-[1.4rem] border border-dashed border-white/12 bg-black/12 p-5 text-sm leading-7 text-[var(--muted)] md:col-span-2">
                {skills.length === 0
                  ? "No skill markdown files found in ~/.hermes/skills yet."
                  : "No skills match the current search query."}
              </div>
            )}
          </div>
        </section>

        <aside className="flex flex-col gap-4">
          <section className="glass-panel rounded-[1.5rem] p-4">
            <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted)]">
              Why this page matters
            </p>
            <div className="mt-4 space-y-3 text-sm leading-7 text-white/90">
              <p>Skill visibility is the clearest difference between a stateless chatbot and a persistent agent.</p>
              <p>For the demo, this page is the proof that Hermes learns instead of restarting from zero.</p>
            </div>
          </section>

          <section className="glass-panel rounded-[1.5rem] p-4">
            <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted)]">
              Memory tie-in
            </p>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-white/90">
              {memory?.content.slice(0, 360) || "No memory content available."}
            </p>
          </section>

          <section className="glass-panel rounded-[1.5rem] p-4">
            <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted)]">
              Recent sessions
            </p>
            <div className="mt-4 space-y-3">
              {sessions.length > 0 ? (
                sessions.map((session) => (
                  <article
                    key={session.id}
                    className="rounded-[1.1rem] border border-white/8 bg-black/20 p-3"
                  >
                    <p className="text-sm font-medium text-white">{session.title}</p>
                    <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                      {session.preview}
                    </p>
                  </article>
                ))
              ) : (
                <p className="text-sm leading-7 text-[var(--muted)]">
                  No sessions are available yet.
                </p>
              )}
            </div>
            {error ? <p className="mt-4 text-sm text-[var(--danger)]">{error}</p> : null}
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
