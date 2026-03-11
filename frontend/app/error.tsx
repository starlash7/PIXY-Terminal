"use client";

import { useEffect } from "react";

import { AppShell } from "@/components/app-shell";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <AppShell
      title="The shell surfaced a recoverable error."
      description="PIXY keeps failure states visible so the product never degrades into a silent blank screen during the demo."
      accentLabel="Error state"
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <section className="glass-panel rounded-[1.75rem] p-5 sm:p-6">
          <div className="state-panel state-panel-danger">
            <p className="text-xs uppercase tracking-[0.28em] text-[var(--danger)]">
              Runtime failure
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-white">
              The route failed, but the product state is still legible.
            </h2>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-white/88">
              {error.message || "An unknown rendering error interrupted this screen."}
            </p>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => reset()}
              className="rounded-full border border-[var(--accent)] bg-[var(--glow)] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[rgba(73,227,165,0.24)]"
            >
              Retry page
            </button>
            <p className="text-sm text-[var(--muted)]">
              Narration cue: &quot;When something breaks, PIXY exposes it as a recoverable
              product state.&quot;
            </p>
          </div>
        </section>

        <aside className="flex flex-col gap-4">
          <section className="glass-panel rounded-[1.5rem] p-4">
            <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted)]">
              Demo fallback
            </p>
            <p className="mt-4 text-sm leading-7 text-white/90">
              Refresh once. If the issue persists, continue the recording on another route and
              call out that failure is explicit instead of hidden.
            </p>
          </section>

          <section className="glass-panel rounded-[1.5rem] p-4">
            <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted)]">
              Why this matters
            </p>
            <p className="mt-4 text-sm leading-7 text-white/90">
              Judges should always see whether the system is loading, live, degraded, or empty.
              Presentation quality depends on that clarity.
            </p>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
