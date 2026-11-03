import { BrandBall } from "./BrandBall";

const WORD = "ZOIKO SPORTS";

/** Bouncing-ball loader used for route loading and the dashboard splash. */
export function BrandLoader({ label = "Loading", fullscreen = true }: { label?: string; fullscreen?: boolean }) {
  return (
    <div
      role="status"
      aria-label={label}
      className={`flex flex-col items-center justify-center gap-8 ${fullscreen ? "fixed inset-0 z-50 bg-bg" : "py-16"}`}
    >
      <div className="neu relative grid size-44 place-items-center rounded-full">
        {/* orbit rings */}
        <svg viewBox="0 0 176 176" className="animate-spin-slow absolute inset-0 [animation-duration:2.4s]" aria-hidden>
          <circle cx="88" cy="88" r="80" fill="none" stroke="var(--brand-blue)" strokeWidth="3" strokeLinecap="round" strokeDasharray="120 380" />
        </svg>
        <svg viewBox="0 0 176 176" className="animate-spin-rev absolute inset-0 [animation-duration:1.8s]" aria-hidden>
          <circle cx="88" cy="88" r="72" fill="none" stroke="var(--brand-yellow)" strokeWidth="3" strokeLinecap="round" strokeDasharray="60 400" />
        </svg>

        <div className="neu-inset relative flex size-28 items-end justify-center overflow-hidden rounded-full pb-4">
          <div className="absolute bottom-3 h-2 w-10 rounded-full bg-navy/40 blur-[2px] [animation:shadow-pulse_1s_ease-in-out_infinite] dark:bg-black/60" />
          <div className="[animation:ball-bounce_1s_cubic-bezier(0.45,0,0.55,1)_infinite]">
            <BrandBall className="animate-spin-slow size-10 [animation-duration:1.2s]" />
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center gap-4">
        <div className="flex font-display text-lg font-extrabold tracking-[0.3em] text-ink">
          {WORD.split("").map((ch, i) => (
            <span key={i} className="inline-block" style={{ animation: `letter-wave 1.6s ease-in-out ${i * 0.08}s infinite` }}>
              {ch === " " ? " " : ch}
            </span>
          ))}
        </div>
        <div className="neu-inset-sm h-2 w-48 overflow-hidden rounded-full">
          <div className="h-full w-2/5 rounded-full bg-gradient-to-r from-blue to-yellow [animation:progress_1.2s_ease-in-out_infinite]" />
        </div>
      </div>
    </div>
  );
}
