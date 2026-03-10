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

export function AppShell({
  title,
  description,
  accentLabel,
  children,
}: AppShellProps) {
  const pathname = usePathname();

  return (
    <main className="px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <section className="glass-panel relative overflow-hidden rounded-[2rem]">
          <div className="grid-noise pointer-events-none absolute inset-0 opacity-30" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_top,rgba(159,255,208,0.18),transparent_55%)]" />

          <header className="relative border-b border-white/6 px-5 py-5 sm:px-8 sm:py-7">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl space-y-3">
                <div className="flex flex-wrap items-center gap-3 text-[0.7rem] uppercase tracking-[0.32em] text-[var(--muted)]">
                  <span className="rounded-full border border-[var(--line)] bg-white/3 px-3 py-1">
                    PIXY TERMINAL
                  </span>
                  <span className="rounded-full border border-emerald-300/18 bg-emerald-300/8 px-3 py-1 text-[var(--accent)]">
                    {accentLabel}
                  </span>
                </div>
                <div className="space-y-2">
                  <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                    {title}
                  </h1>
                  <p className="max-w-2xl text-sm leading-7 text-[var(--muted)] sm:text-base">
                    {description}
                  </p>
                </div>
              </div>

              <nav className="flex flex-wrap gap-2">
                {links.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`rounded-full border px-4 py-2 text-sm transition ${
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
            </div>
          </header>

          <div className="relative px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
