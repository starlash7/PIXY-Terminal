import { AgentHud } from "@/components/agent-hud";
import { ThoughtBubble } from "@/components/thought-bubble";
import type { AgentState, ThoughtCue } from "@/lib/agent-presence";

type AgentPresenceProps = {
  state: AgentState;
  thoughtCue: ThoughtCue | null;
  messageCount: number;
  hasWarning: boolean;
};

const PRESENCE_MOTION: Record<AgentState, string> = {
  idle: "agent-state-idle",
  listening: "agent-state-listening",
  thinking: "agent-state-thinking",
  responding: "agent-state-responding",
  warning: "agent-state-warning",
};

const HALO_TONE: Record<AgentState, string> = {
  idle: "bg-[radial-gradient(circle,rgba(168,85,247,0.22),transparent_68%)] opacity-80",
  listening: "bg-[radial-gradient(circle,rgba(245,158,11,0.22),transparent_70%)] opacity-85",
  thinking: "bg-[radial-gradient(circle,rgba(192,132,252,0.3),transparent_66%)] opacity-95",
  responding: "bg-[radial-gradient(circle,rgba(216,180,254,0.26),transparent_68%)] opacity-90",
  warning: "bg-[radial-gradient(circle,rgba(245,158,11,0.24),transparent_68%)] opacity-85",
};

const CORE_TONE: Record<AgentState, string> = {
  idle: "rgba(196,181,253,0.95)",
  listening: "rgba(253,224,71,0.92)",
  thinking: "rgba(216,180,254,0.95)",
  responding: "rgba(248,250,252,0.95)",
  warning: "rgba(251,191,36,0.95)",
};

function PresenceSpectrum({ state }: { state: AgentState }) {
  const spectrumTone =
    state === "warning"
      ? "from-[rgba(251,191,36,0.95)] to-[rgba(253,230,138,0.4)]"
      : "from-[rgba(216,180,254,0.95)] to-[rgba(196,181,253,0.3)]";
  const bars =
    state === "thinking"
      ? [16, 26, 34, 46, 38, 30, 22, 14]
      : state === "responding"
        ? [12, 20, 32, 24, 28, 18, 26, 12]
        : state === "warning"
          ? [14, 24, 18, 30, 16, 28, 20, 12]
          : [8, 12, 16, 20, 16, 14, 12, 8];

  return (
    <div className="flex items-end gap-1.5">
      {bars.map((height, index) => (
        <span
          key={`${state}-${index}`}
          className={`presence-spectrum-bar inline-block w-[6px] rounded-full bg-gradient-to-t ${spectrumTone}`}
          style={{
            height,
            animationDelay: `${index * 80}ms`,
            animationDuration: `${1500 + index * 60}ms`,
          }}
        />
      ))}
    </div>
  );
}

function HolographicMuse({ state }: { state: AgentState }) {
  const lineTone = CORE_TONE[state];
  const eyes =
    state === "warning"
      ? {
          left: "M144 218c10-12 22-18 36-18",
          right: "M180 200c14 0 26 6 36 18",
        }
      : state === "thinking"
        ? {
            left: "M146 214c10-8 20-12 34-12",
            right: "M180 202c14 0 24 4 34 12",
          }
        : {
            left: "M148 220c10-10 22-15 34-15",
            right: "M178 205c12 0 24 5 34 15",
          };
  const mouth =
    state === "responding"
      ? "M158 288c9 11 17 15 24 15s15-4 24-15"
      : state === "thinking"
        ? "M162 294c8 4 14 6 18 6s10-2 18-6"
        : state === "warning"
          ? "M160 296c10-4 16-6 20-6s10 2 20 6"
          : "M160 290c8 7 15 10 22 10s14-3 22-10";

  return (
    <div className={`relative h-full w-full ${PRESENCE_MOTION[state]}`}>
      <div className="absolute inset-x-[18%] top-[12%] h-[46%] rounded-full bg-[radial-gradient(circle,rgba(168,85,247,0.2),transparent_70%)] blur-3xl" />
      <div className="absolute inset-x-[18%] top-[16%] h-[48%] rounded-full border border-[rgba(168,85,247,0.14)] opacity-90 holo-orbit" />
      <div className="absolute inset-x-[22%] top-[20%] h-[40%] rounded-full border border-[rgba(216,180,254,0.16)] opacity-75 [animation-duration:18s] holo-orbit" />
      <div className="absolute inset-x-[30%] top-[24%] h-[28%] rounded-full border border-[rgba(255,255,255,0.08)] opacity-70 [animation-duration:10s] holo-orbit" />

      <svg
        viewBox="0 0 360 520"
        aria-hidden="true"
        className="agent-ghost-drift absolute inset-[6%] z-0 h-[88%] w-[88%] opacity-35 blur-[2px]"
      >
        <defs>
          <linearGradient id="presence-ghost" x1="180" y1="80" x2="180" y2="440">
            <stop offset="0%" stopColor="rgba(255,255,255,0.16)" />
            <stop offset="100%" stopColor="rgba(168,85,247,0)" />
          </linearGradient>
        </defs>
        <path
          d="M182 88c-58 0-94 42-94 102 0 36 12 72 28 95 10 15 15 27 16 43 1 13 9 24 21 28 18 7 29 9 54 9 25 0 36-2 54-9 12-4 20-15 21-28 1-16 6-28 16-43 16-23 28-59 28-95 0-60-36-102-94-102Z"
          fill="url(#presence-ghost)"
          stroke="rgba(216,180,254,0.26)"
          strokeWidth="2"
        />
      </svg>

      <svg
        viewBox="0 0 360 520"
        aria-hidden="true"
        className="absolute inset-[6%] z-10 h-[88%] w-[88%]"
      >
        <defs>
          <linearGradient id="presence-outline" x1="180" y1="60" x2="180" y2="452">
            <stop offset="0%" stopColor="rgba(255,255,255,0.84)" />
            <stop offset="35%" stopColor={lineTone} />
            <stop offset="100%" stopColor="rgba(168,85,247,0.2)" />
          </linearGradient>
          <linearGradient id="presence-fill" x1="180" y1="96" x2="180" y2="456">
            <stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
            <stop offset="45%" stopColor="rgba(168,85,247,0.12)" />
            <stop offset="100%" stopColor="rgba(8,8,12,0)" />
          </linearGradient>
          <radialGradient id="presence-core" cx="50%" cy="34%" r="44%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.9)" />
            <stop offset="45%" stopColor={lineTone} />
            <stop offset="100%" stopColor="rgba(168,85,247,0)" />
          </radialGradient>
        </defs>

        <ellipse
          cx="180"
          cy="182"
          rx="88"
          ry="104"
          fill="url(#presence-core)"
          opacity="0.24"
          className="ascii-signal"
        />

        <path
          d="M182 88c-58 0-94 42-94 102 0 36 12 72 28 95 10 15 15 27 16 43 1 13 9 24 21 28 18 7 29 9 54 9 25 0 36-2 54-9 12-4 20-15 21-28 1-16 6-28 16-43 16-23 28-59 28-95 0-60-36-102-94-102Z"
          fill="url(#presence-fill)"
          stroke="url(#presence-outline)"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="ascii-signal"
        />

        <path
          d="M115 392c22-26 41-38 67-44 12 14 23 22 50 28 24 5 44 9 69 16 22 6 39 19 48 36"
          fill="none"
          stroke="url(#presence-outline)"
          strokeWidth="2.2"
          strokeLinecap="round"
          opacity="0.72"
        />
        <path
          d="M162 164c8-12 22-18 40-18 18 0 32 6 40 18"
          fill="none"
          stroke="url(#presence-outline)"
          strokeWidth="1.8"
          strokeLinecap="round"
          opacity="0.55"
        />
        <path
          d="M170 206c7-4 15-6 24-6s17 2 24 6"
          fill="none"
          stroke={lineTone}
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.92"
        />
        <path
          d={eyes.left}
          fill="none"
          stroke={lineTone}
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.88"
        />
        <path
          d={eyes.right}
          fill="none"
          stroke={lineTone}
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.88"
        />
        <path
          d="M180 214v58"
          fill="none"
          stroke="url(#presence-outline)"
          strokeWidth="1.6"
          strokeLinecap="round"
          opacity="0.52"
        />
        <path
          d={mouth}
          fill="none"
          stroke={lineTone}
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.76"
        />
        <path
          d="M139 118c-22 18-36 43-41 74m164-74c22 18 36 43 41 74"
          fill="none"
          stroke="rgba(255,255,255,0.22)"
          strokeWidth="1.6"
          strokeLinecap="round"
          opacity="0.75"
        />
      </svg>

      <div className="retro-shader absolute inset-[8%] rounded-[42%] bg-[conic-gradient(from_180deg,rgba(168,85,247,0.1),transparent_28%,rgba(255,255,255,0.08),transparent_68%,rgba(168,85,247,0.12))] opacity-60" />
      <div className="absolute inset-x-[26%] top-[24%] h-[18%] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.12),transparent_72%)] blur-2xl" />
    </div>
  );
}

export function AgentPresence({
  state,
  thoughtCue,
  messageCount,
  hasWarning,
}: AgentPresenceProps) {
  return (
    <div className="pointer-events-none absolute inset-y-0 right-0 z-20 flex w-[22rem] items-end justify-center px-6 pb-6">
      <div className="relative h-[30rem] w-full">
        <ThoughtBubble cue={thoughtCue} />

        <div className="absolute inset-x-0 bottom-0 top-12">
          <div className={`agent-halo absolute inset-4 rounded-[40px] blur-3xl ${HALO_TONE[state]}`} />

          <div className="pixel-frame depth-panel relative h-full overflow-hidden rounded-[34px] border-[rgba(168,85,247,0.22)]">
            <div className="absolute left-4 top-4 z-20 rounded-full border border-[rgba(168,85,247,0.18)] bg-[rgba(12,12,12,0.72)] px-3 py-1">
              <p className="text-[9px] uppercase tracking-[0.18em] text-[var(--accent-purple)]">
                pixy.agent
              </p>
            </div>

            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(168,85,247,0.16),transparent_40%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent_24%,transparent_68%,rgba(168,85,247,0.08))]" />

            <div className="absolute inset-[12px] overflow-hidden rounded-[28px] border border-[rgba(255,255,255,0.07)] bg-[rgba(8,8,12,0.94)]">
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(28,16,38,0.18),rgba(8,8,12,0.12))]" />
              <div className="absolute inset-0 terminal-grid opacity-20" />
              <div className="absolute inset-0 terminal-scanlines opacity-20" />

              <HolographicMuse state={state} />

              <div className="absolute inset-x-6 bottom-[5.25rem] z-20 flex items-end justify-between gap-4">
                <div>
                  <p className="text-[9px] uppercase tracking-[0.18em] text-[var(--accent-purple)]">
                    voice activity
                  </p>
                  <div className="mt-2">
                    <PresenceSpectrum state={state} />
                  </div>
                </div>
                <div className="rounded-[16px] border border-[rgba(168,85,247,0.16)] bg-[rgba(10,10,14,0.72)] px-3 py-2">
                  <p className="text-[9px] uppercase tracking-[0.16em] text-[var(--accent-purple)]">
                    semantic shell
                  </p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-[rgba(248,250,252,0.9)]">
                    {state}
                  </p>
                </div>
              </div>

              <div className="scan-beam absolute inset-0 bg-[linear-gradient(180deg,transparent_8%,rgba(216,180,254,0.12)_48%,transparent_92%)]" />

              <div className="absolute inset-x-4 bottom-4 z-20">
                <AgentHud state={state} messageCount={messageCount} hasWarning={hasWarning} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
