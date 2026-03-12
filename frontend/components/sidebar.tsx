"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

function MessageIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7A2.5 2.5 0 0 1 17.5 16H9l-4.5 4v-4A2.5 2.5 0 0 1 2 13.5v-7Z" />
    </svg>
  );
}

function DashboardIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3.5 3.5h7v7h-7zM13.5 3.5h7v4h-7zM13.5 10.5h7v10h-7zM3.5 13.5h7v7h-7z" />
    </svg>
  );
}

function ZapIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
    </svg>
  );
}

const items: NavItem[] = [
  { href: "/chat", label: "Chat", icon: <MessageIcon /> },
  { href: "/dashboard", label: "Dashboard", icon: <DashboardIcon /> },
  { href: "/skills", label: "Skills", icon: <ZapIcon /> },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="flex min-h-full flex-col justify-between border-r border-[var(--border-default)] bg-[linear-gradient(180deg,rgba(18,12,24,0.98),rgba(12,12,12,0.98))]"
      style={{ fontFamily: "var(--font-pixel)" }}
    >
      <nav className="px-3 py-4">
        <p className="px-3 pb-2 text-[11px] uppercase tracking-[0.28em] text-[var(--accent-amber)]">
          WORKSPACE
        </p>
        <div className="space-y-1">
          {items.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex items-center gap-3 rounded-[16px] border px-3 py-2.5 text-sm uppercase tracking-[0.08em] transition-all duration-150 ${
                  active
                    ? "border-[rgba(168,85,247,0.24)] bg-[rgba(168,85,247,0.12)] text-[rgba(248,250,252,0.95)]"
                    : "border-transparent text-[var(--text-muted)] hover:border-[rgba(168,85,247,0.16)] hover:bg-[rgba(168,85,247,0.08)] hover:text-[rgba(248,250,252,0.92)]"
                }`}
              >
                {active ? (
                  <span className="absolute left-0 top-1.5 h-7 w-0.5 rounded-full bg-[var(--accent-purple)]" />
                ) : null}
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="border-t border-[var(--border-default)] px-4 py-3">
        <p className="mb-1 text-[11px] uppercase tracking-[0.24em] text-[var(--accent-amber)]">
          LOCAL API
        </p>
        <p className="text-[12px] uppercase tracking-[0.14em] text-[var(--accent-purple)]">
          127.0.0.1:8000
        </p>
      </div>
    </aside>
  );
}
