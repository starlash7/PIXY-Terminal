export type AgentState = "idle" | "listening" | "thinking" | "responding" | "warning";

export type ThoughtCue = {
  id: string;
  text: string;
  state: AgentState;
  durationMs: number;
};

const THOUGHT_DURATION: Record<AgentState, number> = {
  idle: 0,
  listening: 1500,
  thinking: 2200,
  responding: 1700,
  warning: 2400,
};

const THOUGHT_POOL: Record<Exclude<AgentState, "idle">, readonly string[]> = {
  listening: [
    "reading intent...",
    "matching prior context...",
    "checking your last turn...",
    "aligning prompt thread...",
  ],
  thinking: [
    "opening memory layer...",
    "routing best skill...",
    "drafting reply...",
    "compressing response...",
  ],
  responding: [
    "response ready...",
    "keeping thread stable...",
    "handoff complete...",
    "finalizing output...",
  ],
  warning: [
    "fallback path engaged...",
    "simulator route active...",
    "retry path warming...",
    "signal requires review...",
  ],
};

export function buildThoughtCue(
  state: AgentState,
  previousText?: string | null,
): ThoughtCue | null {
  if (state === "idle") {
    return null;
  }

  const pool = THOUGHT_POOL[state];
  const candidates = pool.filter((entry) => entry !== previousText);
  const nextPool = candidates.length > 0 ? candidates : [...pool];
  const text = nextPool[Math.floor(Math.random() * nextPool.length)];

  return {
    id: `${state}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text,
    state,
    durationMs: THOUGHT_DURATION[state],
  };
}
