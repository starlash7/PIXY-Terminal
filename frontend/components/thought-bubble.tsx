import type { ThoughtCue } from "@/lib/agent-presence";

type ThoughtBubbleProps = {
  cue: ThoughtCue | null;
};

const BUBBLE_TONE: Record<NonNullable<ThoughtCue>["state"], string> = {
  idle: "border-[rgba(168,85,247,0.22)] bg-[rgba(24,16,32,0.9)] text-[var(--text-primary)]",
  listening:
    "border-[rgba(245,158,11,0.2)] bg-[rgba(38,24,12,0.9)] text-[rgba(254,243,199,0.92)]",
  thinking:
    "border-[rgba(168,85,247,0.24)] bg-[rgba(24,16,32,0.92)] text-[rgba(233,213,255,0.95)]",
  responding:
    "border-[rgba(196,181,253,0.24)] bg-[rgba(28,18,38,0.92)] text-[rgba(248,250,252,0.95)]",
  warning:
    "border-[rgba(245,158,11,0.26)] bg-[rgba(32,22,10,0.92)] text-[rgba(254,243,199,0.95)]",
};

export function ThoughtBubble({ cue }: ThoughtBubbleProps) {
  if (!cue) {
    return null;
  }

  return (
    <div
      key={cue.id}
      className={`agent-bubble-enter absolute right-[5.5rem] top-0 z-30 max-w-[13rem] rounded-[18px] px-4 py-3 shadow-[0_18px_40px_rgba(0,0,0,0.32)] ${BUBBLE_TONE[cue.state]}`}
    >
      <p className="text-[11px] uppercase tracking-[0.12em]">{cue.text}</p>
      <span
        className={`absolute -bottom-2 right-8 h-4 w-4 rotate-45 border-r border-b ${BUBBLE_TONE[cue.state]}`}
      />
    </div>
  );
}
