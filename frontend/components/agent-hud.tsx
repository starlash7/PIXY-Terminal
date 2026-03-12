import type { AgentState } from "@/lib/agent-presence";

type AgentHudProps = {
  state: AgentState;
  messageCount: number;
  hasWarning: boolean;
};

function labelForState(state: AgentState): string {
  switch (state) {
    case "listening":
      return "listen";
    case "thinking":
      return "think";
    case "responding":
      return "reply";
    case "warning":
      return "review";
    default:
      return "idle";
  }
}

export function AgentHud({ state, messageCount, hasWarning }: AgentHudProps) {
  const chips = [
    { label: "state", value: labelForState(state) },
    { label: "turns", value: messageCount.toString().padStart(2, "0") },
    { label: "memory", value: hasWarning ? "review" : "ready" },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {chips.map((chip) => (
        <div
          key={chip.label}
          className="rounded-[14px] border border-[rgba(168,85,247,0.16)] bg-[rgba(10,10,14,0.72)] px-3 py-2 backdrop-blur-sm"
        >
          <p className="text-[9px] uppercase tracking-[0.16em] text-[var(--accent-purple)]">
            {chip.label}
          </p>
          <p className="mt-1 text-[11px] uppercase tracking-[0.1em] text-[rgba(248,250,252,0.92)]">
            {chip.value}
          </p>
        </div>
      ))}
    </div>
  );
}
