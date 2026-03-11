"use client";

import { useDeferredValue, useEffect, useEffectEvent, useState } from "react";

import { getJson } from "@/lib/client";
import type { SkillCard, SkillsResponse } from "@/lib/types";

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function SkillsBoard() {
  const [skills, setSkills] = useState<SkillCard[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(query);

  const refresh = useEffectEvent(async () => {
    const skillsData = await getJson<SkillsResponse>("/api/skills");
    setSkills(skillsData.skills);
  });

  useEffect(() => {
    void refresh().catch((refreshError) => {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "Failed to load skills.",
      );
    });
  }, []);

  const filteredSkills = skills.filter((skill) => {
    const haystack = `${skill.title} ${skill.summary} ${skill.path}`.toLowerCase();
    return haystack.includes(deferredQuery.trim().toLowerCase());
  });

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col">
      <div className="border-b border-[var(--border-default)] px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-[20px] font-semibold text-[var(--text-primary)]">Skills</h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Search and inspect Hermes skills from local storage.
            </p>
          </div>
          <span className="rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
            {filteredSkills.length} loaded
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
        <div className="space-y-6">
          <div className="panel-elevated flex items-center gap-3 px-4 py-3">
            <span className="text-[var(--text-muted)]">
              <SearchIcon />
            </span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search skills"
              className="w-full bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
            />
          </div>

          {error ? (
            <div className="rounded-xl border border-[rgba(239,68,68,0.22)] bg-[rgba(239,68,68,0.08)] px-4 py-3 text-sm text-[var(--accent-red)]">
              {error}
            </div>
          ) : null}

          {filteredSkills.length > 0 ? (
            <section className="grid grid-cols-2 gap-4">
              {filteredSkills.map((skill) => (
                <article
                  key={skill.id}
                  className="panel p-5 transition-all duration-150 hover:border-[var(--accent-purple)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold text-[var(--text-primary)]">
                        {skill.title}
                      </h2>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">{skill.id}</p>
                    </div>
                    <span className="rounded-full border border-[var(--border-default)] bg-[var(--bg-elevated)] px-2 py-1 text-xs text-[var(--text-primary)]">
                      active
                    </span>
                  </div>
                  <p className="mt-4 line-clamp-2 text-sm leading-6 text-[var(--text-muted)]">
                    {skill.summary}
                  </p>
                  <div className="mt-5 flex items-end justify-between gap-3">
                    <p className="mono-copy text-[12px] text-[var(--text-muted)]">
                      {skill.path}
                    </p>
                    <p className="mono-copy shrink-0 text-[11px] text-[var(--text-muted)]">
                      {formatDate(skill.last_updated)}
                    </p>
                  </div>
                </article>
              ))}
            </section>
          ) : (
            <div className="panel px-5 py-6 text-sm text-[var(--text-muted)]">
              No skills found in ~/.hermes/skills
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
