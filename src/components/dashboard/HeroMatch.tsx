"use client";

import { Bell } from "lucide-react";
import { useEffect, useState } from "react";
import { BrandBall } from "@/components/brand/BrandBall";
import { AvatarStack } from "@/components/ui/Avatar";
import { Crest } from "@/components/ui/Crest";
import { TEAMS, type Team } from "@/lib/data";

const KICKOFF_IN_SECONDS = 8 * 3600 + 12 * 60 + 21;

const SPLIT = [
  { label: "WHU", pct: 46, tips: 234, names: ["Dolly Krista", "Leo Park", "Nia Cole"] },
  { label: "DRAW", pct: 22, tips: 98, names: ["Raj Mehta", "Sara Kim"] },
  { label: "LEV", pct: 32, tips: 131, names: ["Omar Haddad", "Mia Lopez", "Ivy Chen"] },
];

export function HeroMatch() {
  const countdown = useCountdown(KICKOFF_IN_SECONDS);

  return (
    <section className="group relative overflow-hidden rounded-[28px] bg-[linear-gradient(130deg,#2a6597_0%,#3a7fb8_45%,#25163a_120%)] p-5 text-white shadow-[10px_10px_24px_var(--sh-dark),-8px_-8px_20px_var(--sh-light)] transition-transform duration-500 hover:-translate-y-1 sm:p-6">
      {/* pitch lines */}
      <svg viewBox="0 0 600 300" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 size-full opacity-[0.12]" aria-hidden>
        <g fill="none" stroke="white" strokeWidth="2">
          <rect x="10" y="10" width="580" height="280" rx="12" />
          <line x1="300" y1="10" x2="300" y2="290" />
          <circle cx="300" cy="150" r="58" />
          <rect x="10" y="90" width="70" height="120" />
          <rect x="520" y="90" width="70" height="120" />
        </g>
      </svg>
      <div className="pointer-events-none absolute -right-10 -top-16 size-64 rounded-full bg-yellow/20 blur-3xl" aria-hidden />

      {/* top row */}
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-xl bg-white/15 backdrop-blur">
            <Bell className="size-4" />
          </span>
          <div className="flex items-center gap-1 font-display text-sm font-semibold tabular-nums">
            {countdown.map((v, i) => (
              <span key={i} className="flex items-center gap-1">
                <span className="rounded-md bg-white/15 px-1.5 py-0.5">{v}</span>
                {i < 2 && <span className="animate-pulse">:</span>}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="relative grid size-9 place-items-center rounded-full border-2 border-white/60">
            <span className="size-2.5 rounded-full bg-white animate-live" />
          </span>
          <AvatarStack names={["Micky Larcko", "Aria Stone"]} size="sm" />
        </div>
      </div>

      {/* teams */}
      <div className="relative mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <TeamBlock team={TEAMS.whu} />
        <div className="relative grid size-28 place-items-center sm:size-36">
          <div className="absolute inset-0 rounded-full border border-dashed border-white/40 animate-spin-slow" />
          <div className="absolute inset-3 rounded-full bg-white/10 backdrop-blur-sm" />
          <BrandBall className="animate-float relative size-16 drop-shadow-[0_18px_22px_rgba(0,0,0,0.45)] transition-transform duration-700 group-hover:rotate-[200deg] sm:size-20" />
          <span className="absolute -bottom-1 rounded-full bg-yellow px-3 py-0.5 font-display text-xs font-extrabold text-navy shadow-lg">
            VS
          </span>
        </div>
        <TeamBlock team={TEAMS.lev} align="right" />
      </div>

      {/* split bar */}
      <div className="relative mt-5 flex h-1.5 gap-1 overflow-hidden rounded-full">
        <div className="rounded-full bg-white transition-all duration-1000" style={{ width: `${SPLIT[0].pct}%` }} />
        <div className="rounded-full bg-white/40" style={{ width: `${SPLIT[1].pct}%` }} />
        <div className="rounded-full bg-yellow" style={{ width: `${SPLIT[2].pct}%` }} />
      </div>

      {/* tip pills */}
      <div className="relative mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {SPLIT.map((s) => (
          <div
            key={s.label}
            className="flex cursor-pointer items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-semibold backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/20"
          >
            <AvatarStack names={s.names} size="xs" />
            <span>
              {s.label} {s.pct}% · {s.tips} tips
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function TeamBlock({ team, align = "left" }: { team: Team; align?: "left" | "right" }) {
  return (
    <div className={`flex flex-col gap-2 ${align === "right" ? "items-end text-right" : "items-start"}`}>
      <span className="grid size-12 place-items-center rounded-full bg-white/90 shadow-lg transition-transform duration-300 hover:scale-110">
        <Crest team={team} className="size-8" />
      </span>
      <div>
        <div className="text-xs font-semibold tracking-wider text-white/70">{team.code}</div>
        <div className="font-display text-base font-bold leading-tight sm:text-xl">{team.name}</div>
      </div>
    </div>
  );
}

function useCountdown(start: number) {
  const [left, setLeft] = useState(start);
  useEffect(() => {
    const id = setInterval(() => setLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, []);
  return [Math.floor(left / 3600), Math.floor((left % 3600) / 60), left % 60].map((n) => String(n).padStart(2, "0"));
}
