"use client";

import { Check, Star, Users } from "lucide-react";
import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Crest } from "@/components/ui/Crest";
import { HOT_TIPS, leagueBySlug, matchById } from "@/lib/data";

export function HotTipsView() {
  const [featured, setFeatured] = useState<Set<string>>(new Set(["t1"]));
  const [approved, setApproved] = useState<Set<string>>(new Set(["t1", "t2"]));

  const flip = (set: Set<string>, id: string) => {
    const n = new Set(set);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {HOT_TIPS.map((t, i) => {
        const m = matchById(t.match);
        const league = leagueBySlug(m.league)!;
        const isFeatured = featured.has(t.id);
        const isApproved = approved.has(t.id);
        return (
          <div key={t.id} style={{ animationDelay: `${i * 70}ms` }} className="neu-card animate-rise group relative overflow-hidden rounded-3xl p-5">
            {isFeatured && (
              <span className="absolute right-0 top-0 rounded-bl-2xl bg-yellow px-3 py-1 text-[10px] font-extrabold uppercase text-navy">Featured</span>
            )}
            <div className="flex items-center gap-2 text-xs font-semibold text-muted">
              <span className="grid size-5 place-items-center rounded-full text-[7px] font-black text-white" style={{ background: league.color }}>
                {league.code}
              </span>
              {league.name} · {m.date}, {m.time}
              {m.status === "live" && <span className="rounded bg-danger px-1.5 text-[9px] font-bold uppercase text-white animate-live">Live</span>}
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <Crest team={m.home} className="size-9 shrink-0 transition-transform group-hover:-rotate-6" />
                <span className="truncate font-semibold">{m.home.name}</span>
              </div>
              <span className="text-xs font-bold text-muted">{m.score ?? "VS"}</span>
              <div className="flex min-w-0 items-center justify-end gap-2">
                <span className="truncate text-right font-semibold">{m.away.name}</span>
                <Crest team={m.away} className="size-9 shrink-0 transition-transform group-hover:rotate-6" />
              </div>
            </div>

            <div className="neu-inset-sm mt-4 flex items-center justify-between rounded-2xl p-3">
              <div>
                <div className="text-[11px] text-muted">Pick</div>
                <div className="font-display font-bold">{t.pick}</div>
              </div>
              <div className="rounded-xl bg-gradient-to-r from-blue-deep to-blue px-3 py-1.5 font-display text-lg font-bold text-white">@{t.odds.toFixed(2)}</div>
            </div>

            <div className="mt-4">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-muted">Confidence</span>
                <span>{t.confidence}%</span>
              </div>
              <div className="neu-inset-sm mt-1.5 h-2.5 overflow-hidden rounded-full">
                <div className="h-full rounded-full bg-gradient-to-r from-blue to-yellow transition-all duration-1000" style={{ width: `${t.confidence}%` }} />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Avatar name={t.tipster} size="sm" />
              <div className="text-sm">
                <div className="font-semibold">{t.tipster}</div>
                <div className="flex items-center gap-1 text-[11px] text-muted">
                  <Users className="size-3" /> {t.backers} backers
                </div>
              </div>
              <div className="ml-auto flex gap-2">
                <button
                  onClick={() => setFeatured((s) => flip(s, t.id))}
                  aria-label="Feature tip"
                  className={`grid size-9 place-items-center rounded-xl transition ${isFeatured ? "neu-inset-sm text-yellow" : "neu-btn text-muted"}`}
                >
                  <Star className={`size-4 ${isFeatured ? "fill-current" : ""}`} />
                </button>
                <button
                  onClick={() => setApproved((s) => flip(s, t.id))}
                  className={`flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition ${
                    isApproved ? "bg-success/15 text-success" : "neu-btn"
                  }`}
                >
                  <Check className="size-4" /> {isApproved ? "Approved" : "Approve"}
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
