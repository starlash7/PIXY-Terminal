"use client";

import { useEffect, useEffectEvent, useState } from "react";

import { getJson } from "@/lib/client";
import type { HealthResponse } from "@/lib/types";

function dotTone(health: HealthResponse | null): string {
  if (!health) {
    return "bg-[var(--accent-red)]";
  }
  if (health.runtime_mode === "simulator") {
    return "bg-[var(--accent-amber)]";
  }
  if (health.hermes_available) {
    return "bg-[var(--accent-green)]";
  }
  return "bg-[var(--accent-red)]";
}

function labelFor(health: HealthResponse | null): string {
  if (!health) {
    return "Disconnected";
  }
  if (health.runtime_mode === "simulator") {
    return "Simulator Mode";
  }
  if (health.hermes_available) {
    return "Hermes Connected";
  }
  return "Disconnected";
}

export function StatusBadge() {
  const [health, setHealth] = useState<HealthResponse | null>(null);

  const refresh = useEffectEvent(async () => {
    const payload = await getJson<HealthResponse>("/api/health");
    setHealth(payload);
  });

  useEffect(() => {
    void refresh().catch(() => {
      setHealth(null);
    });

    const interval = window.setInterval(() => {
      void refresh().catch(() => {
        setHealth(null);
      });
    }, 15000);

    return () => window.clearInterval(interval);
  }, []);

  const connected = Boolean(
    health && health.hermes_available && health.runtime_mode !== "simulator",
  );

  return (
    <div
      className="inline-flex items-center gap-2 rounded-full border border-[rgba(168,85,247,0.2)] bg-[rgba(24,16,32,0.86)] px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] text-[var(--text-primary)] transition-all duration-150"
      style={{ fontFamily: "var(--font-pixel)" }}
    >
      <span className={`${connected ? "pulse-dot" : ""} h-2 w-2 rounded-full`}>
        <span className={`block h-2 w-2 rounded-full ${dotTone(health)}`} />
      </span>
      <span>{labelFor(health)}</span>
    </div>
  );
}
