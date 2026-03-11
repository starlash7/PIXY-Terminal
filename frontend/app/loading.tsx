import { AppShell } from "@/components/app-shell";

const railWidths = ["w-24", "w-32", "w-20"];

export default function Loading() {
  return (
    <AppShell
      title="Preparing the next demo surface."
      description="PIXY is loading runtime state from Hermes so the recording stays continuous across pages."
      accentLabel="Loading"
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.85fr)]">
        <section className="glass-panel rounded-[1.75rem] p-4 sm:p-5">
          <div className="border-b border-white/6 pb-5">
            <div className="loading-shimmer h-3 w-24 rounded-full" />
            <div className="loading-shimmer mt-4 h-10 w-56 rounded-2xl" />
            <div className="loading-shimmer mt-3 h-4 w-full rounded-full" />
            <div className="loading-shimmer mt-2 h-4 w-4/5 rounded-full" />
          </div>

          <div className="mt-5 space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="state-panel">
                <div className="loading-shimmer h-3 w-20 rounded-full" />
                <div className="loading-shimmer mt-4 h-4 w-full rounded-full" />
                <div className="loading-shimmer mt-2 h-4 w-5/6 rounded-full" />
                <div className="loading-shimmer mt-2 h-4 w-2/3 rounded-full" />
              </div>
            ))}
          </div>
        </section>

        <aside className="flex flex-col gap-4">
          {railWidths.map((widthClass, index) => (
            <section key={index} className="glass-panel rounded-[1.5rem] p-4">
              <div className={`loading-shimmer h-3 rounded-full ${widthClass}`} />
              <div className="loading-shimmer mt-4 h-4 w-full rounded-full" />
              <div className="loading-shimmer mt-2 h-4 w-4/5 rounded-full" />
            </section>
          ))}
        </aside>
      </div>
    </AppShell>
  );
}
