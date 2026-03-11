"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type AppShellProps = {
  title: string;
  description: string;
  accentLabel: string;
  children: React.ReactNode;
};

const links = [
  { href: "/", label: "Chat" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/skills", label: "Skills" },
];

const routeMeta: Record<
  string,
  {
    step: string;
    focus: string;
    recordingCue: string;
  }
> = {
  "/": {
    step: "Step 1 · Live prompt",
    focus: "Lead with one real request, then point to runtime, memory, and recent sessions.",
    recordingCue:
      '"This is the command center: action on the left, persistent context on the right."',
  },
  "/dashboard": {
    step: "Step 3 · Proof layer",
    focus: "Close the walkthrough with memory depth, skill count, session continuity, and runtime notes.",
    recordingCue:
      '"The dashboard turns hidden Hermes state into something judges can scan in seconds."',
  },
  "/skills": {
    step: "Step 2 · Skill library",
    focus: "Show that learned workflows become visible assets instead of disappearing into local files.",
    recordingCue:
      '"This is how PIXY shows accumulated capability, not just one-off chat answers."',
  },
};

export function AppShell({
  title,
  description,
  accentLabel,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const activeMeta = routeMeta[pathname] ?? {
    step: "Demo flow",
    focus: "Keep the walkthrough tight: chat, skills, dashboard, then a quick phone-width pass.",
    recordingCue:
      '"PIXY keeps Hermes legible across chat, memory, sessions, and learned skills."',
  };

  return (
    <main className="px-3 pb-6 pt-[max(0.9rem,env(safe-area-inset-top))] sm:px-6 sm:py-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <section className="glass-panel relative overflow-hidden rounded-[2rem] sm:rounded-[2.25rem]">
          <div className="grid-noise pointer-events-none absolute inset-0 opacity-30" />
          <div className="ambient-orb ambient-orb-left pointer-events-none" />
          <div className="ambient-orb ambient-orb-right pointer-events-none" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_top,rgba(159,255,208,0.18),transparent_55%)]" />

          <header className="relative border-b border-white/6 px-4 py-5 sm:px-8 sm:py-7">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-3xl space-y-3">
                <div className="flex flex-wrap items-center gap-3 text-[0.7rem] uppercase tracking-[0.32em] text-[var(--muted)]">
                  <span className="rounded-full border border-[var(--line)] bg-white/3 px-3 py-1">
                    PIXY TERMINAL
                  </span>
                  <span className="rounded-full border border-emerald-300/18 bg-emerald-300/8 px-3 py-1 text-[var(--accent)]">
                    {accentLabel}
                  </span>
                  <span className="rounded-full border border-white/8 bg-black/15 px-3 py-1">
                    Desktop + mobile
                  </span>
                </div>
                <div className="space-y-2">
                  <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-[2.8rem]">
                    {title}
                  </h1>
                  <p className="max-w-2xl text-sm leading-7 text-[var(--muted)] sm:text-base">
                    {description}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:max-w-xl">
                <section className="shell-stage">
                  <p className="text-[0.68rem] uppercase tracking-[0.3em] text-[var(--muted)]">
                    Demo step
                  </p>
                  <p className="mt-3 text-base font-medium text-white">{activeMeta.step}</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                    {activeMeta.focus}
                  </p>
                </section>
                <section className="shell-stage shell-stage-accent">
                  <p className="text-[0.68rem] uppercase tracking-[0.3em] text-[var(--muted)]">
                    Recording cue
                  </p>
                  <p className="mt-3 text-sm leading-6 text-white/92">
                    {activeMeta.recordingCue}
                  </p>
                </section>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <nav className="grid grid-cols-3 gap-2 sm:inline-flex sm:flex-wrap">
                {links.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`rounded-full border px-4 py-2 text-center text-sm transition ${
                        active
                          ? "border-[var(--accent)] bg-[var(--glow)] text-white"
                          : "border-white/10 bg-black/15 text-[var(--muted)] hover:border-white/20 hover:text-white"
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>

              <div className="flex flex-wrap gap-2">
                {[
                  "2-minute walkthrough",
                  "Fallback runtime visible",
                  "Phone-width ready",
                ].map((tag) => (
                  <span key={tag} className="shell-tag">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </header>

          <div className="relative border-b border-white/6 px-4 py-3 sm:px-8">
            <p className="text-sm leading-6 text-[var(--muted)]">
              Recommended demo order: <span className="text-white">Chat</span>, then{" "}
              <span className="text-white">Skills</span>, then{" "}
              <span className="text-white">Dashboard</span>, and finish with a quick mobile-width pass.
            </p>
          </div>

          <div className="relative px-3 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
