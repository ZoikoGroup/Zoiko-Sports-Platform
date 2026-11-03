"use client";

import { ChevronDown, ChevronUp, Pin } from "lucide-react";
import { useState } from "react";
import { AvatarStack } from "@/components/ui/Avatar";
import { Crest } from "@/components/ui/Crest";
import { leagueBySlug, MATCHES, type League, type Match } from "@/lib/data";

type Tab = "all" | "live" | "finished" | "scheduled" | "pinned";

type Props = {
  title?: string;
  league?: League;
  matches?: Match[];
};

export function FootballGames({ title = "Football Games", league = leagueBySlug("laliga")!, matches }: Props) {
  const source = matches ?? MATCHES.filter((m) => m.league === league.slug);
  const [tab, setTab] = useState<Tab>("all");
  const [pinned, setPinned] = useState<Set<string>>(() => new Set(source.slice(0, 1).map((m) => m.id)));
  const [expanded, setExpanded] = useState(true);

  const tabs: { id: Tab; label: string }[] = [
    { id: "all", label: "All Games" },
    { id: "live", label: "Live Games" },
    { id: "finished", label: "Finished" },
    { id: "scheduled", label: "Scheduled" },
    { id: "pinned", label: `Pinned (${pinned.size})` },
  ];

  const rows = source.filter((m) =>
    tab === "all" ? true : tab === "pinned" ? pinned.has(m.id) : m.status === tab,
  );

  function togglePin(id: string) {
    setPinned((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold">{title}</h2>
        <button className="neu-btn flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold">
          More Bets <ChevronDown className="size-4" />
        </button>
      </div>

      <div className="neu-inset-sm mt-5 flex gap-1 overflow-x-auto rounded-2xl p-1.5">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`shrink-0 rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-300 ${
              tab === t.id
                ? "bg-gradient-to-r from-blue-deep to-blue text-white shadow-[0_6px_16px_rgb(58_127_184/0.35)]"
                : "text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <button
        onClick={() => setExpanded((e) => !e)}
        className="mt-5 flex w-full items-center gap-3 border-b border-line px-1 pb-3 text-sm font-semibold"
      >
        <span className="flex h-4 w-6 flex-col overflow-hidden rounded-sm" aria-hidden>
          <span className="h-1/3" style={{ background: league.flag[0] }} />
          <span className="h-1/3" style={{ background: league.flag[1] }} />
          <span className="h-1/3" style={{ background: league.flag[2] }} />
        </span>
        {league.country}
        <span className="ml-auto mr-auto flex items-center gap-2 text-muted sm:ml-24">
          <span className="grid size-5 place-items-center rounded-full text-[7px] font-black text-white" style={{ background: league.color }}>
            {league.code}
          </span>
          {league.name}
        </span>
        {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
      </button>

      <div className={`grid transition-[grid-template-rows] duration-500 ${expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          <ul className="space-y-3.5 px-1 pb-2 pt-4">
            {rows.map((m, i) => (
              <MatchRow key={m.id} match={m} index={i} pinned={pinned.has(m.id)} onPin={() => togglePin(m.id)} />
            ))}
            {rows.length === 0 && (
              <li className="neu-inset rounded-2xl py-10 text-center text-sm text-muted">No games in this view yet.</li>
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}

function MatchRow({ match: m, index, pinned, onPin }: { match: Match; index: number; pinned: boolean; onPin: () => void }) {
  const live = m.status === "live";
  return (
    <li
      style={{ animationDelay: `${index * 70}ms` }}
      className={`neu-card animate-rise group relative grid grid-cols-[64px_1fr_auto] items-center gap-3 rounded-2xl px-4 py-3 sm:grid-cols-[90px_1fr_auto_1fr_auto] ${
        live ? "before:absolute before:inset-y-3 before:left-0 before:w-1 before:rounded-r-full before:bg-success" : ""
      }`}
    >
      <div className="flex flex-col">
        <span className="font-display font-bold">{m.time}</span>
        <span className="text-xs text-muted">{m.date}</span>
      </div>

      {/* mobile: compact teams */}
      <div className="flex min-w-0 flex-col gap-1 text-sm font-semibold sm:hidden">
        <span className="flex items-center gap-2 truncate"><Crest team={m.home} className="size-5" />{m.home.name}</span>
        <span className="flex items-center gap-2 truncate"><Crest team={m.away} className="size-5" />{m.away.name}</span>
      </div>

      <div className="hidden min-w-0 items-center gap-3 sm:flex">
        {live && <span className="rounded-md bg-danger px-2 py-0.5 text-[10px] font-bold uppercase text-white animate-live">Live</span>}
        <Crest team={m.home} className="size-7 shrink-0 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110" />
        <span className="truncate text-sm font-semibold">{m.home.name}</span>
      </div>

      <ScoreRing match={m} />

      <div className="hidden min-w-0 items-center gap-3 sm:flex">
        <Crest team={m.away} className="size-7 shrink-0 transition-transform duration-300 group-hover:rotate-6 group-hover:scale-110" />
        <span className="truncate text-sm font-semibold">{m.away.name}</span>
      </div>

      <div className="hidden items-center gap-3 sm:flex">
        <AvatarStack names={m.tipsters} size="sm" />
        <button
          onClick={onPin}
          aria-label={pinned ? "Unpin game" : "Pin game"}
          className={`grid size-8 place-items-center rounded-lg transition-all duration-300 hover:scale-110 ${
            pinned ? "neu-inset-sm text-yellow" : "text-muted opacity-0 group-hover:opacity-100"
          }`}
        >
          <Pin className={`size-4 ${pinned ? "fill-current" : ""}`} />
        </button>
      </div>
    </li>
  );
}

function ScoreRing({ match: m }: { match: Match }) {
  const progress = m.status === "live" ? (m.minute ?? 0) / 90 : m.status === "finished" ? 1 : 0;
  const c = 2 * Math.PI * 17;
  return (
    <div className="neu-sm relative grid size-11 shrink-0 place-items-center rounded-full">
      <svg viewBox="0 0 40 40" className="absolute inset-0 -rotate-90">
        <circle
          cx="20" cy="20" r="17" fill="none"
          stroke={m.status === "live" ? "var(--success)" : "var(--primary)"}
          strokeWidth="2.5" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - progress)}
          className="transition-[stroke-dashoffset] duration-1000"
        />
      </svg>
      <span className={`text-xs font-bold ${m.score ? "" : "text-muted"}`}>{m.score ?? "vs"}</span>
    </div>
  );
}
