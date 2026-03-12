import { StatusBadge } from "@/components/status-badge";

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3.75a1.75 1.75 0 0 1 1.75 1.75v.35a6.48 6.48 0 0 1 1.96.81l.25-.25a1.75 1.75 0 1 1 2.47 2.47l-.25.25c.37.62.64 1.28.8 1.97h.37a1.75 1.75 0 1 1 0 3.5h-.37a6.6 6.6 0 0 1-.8 1.96l.25.25a1.75 1.75 0 1 1-2.47 2.47l-.25-.25a6.48 6.48 0 0 1-1.96.81v.35a1.75 1.75 0 1 1-3.5 0v-.35a6.48 6.48 0 0 1-1.96-.81l-.25.25a1.75 1.75 0 0 1-2.47-2.47l.25-.25a6.48 6.48 0 0 1-.81-1.96H4.4a1.75 1.75 0 0 1 0-3.5h.35c.17-.69.44-1.35.81-1.97l-.25-.25A1.75 1.75 0 0 1 7.78 6.4l.25.25a6.48 6.48 0 0 1 1.96-.81V5.5A1.75 1.75 0 0 1 12 3.75Z" />
      <circle cx="12" cy="12" r="2.75" />
    </svg>
  );
}

export function TopBar() {
  return (
    <header
      className="flex h-12 items-center justify-between border-b border-[var(--border-default)] bg-[linear-gradient(180deg,rgba(18,12,24,0.98),rgba(12,12,12,0.98))] px-4"
      style={{ fontFamily: "var(--font-pixel)" }}
    >
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold uppercase tracking-[0.32em] text-[var(--accent-amber)]">
          PIXY
        </span>
        <span className="text-sm uppercase tracking-[0.24em] text-[var(--accent-purple)]">
          TERMINAL
        </span>
      </div>
      <div className="flex items-center gap-2">
        <StatusBadge />
        <button
          type="button"
          aria-label="Settings"
          className="pixel-frame depth-panel inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--accent-purple)] transition-all duration-150 hover:text-[var(--accent-amber)]"
        >
          <SettingsIcon />
        </button>
      </div>
    </header>
  );
}
