"use client";

import { Flame, UserCheck, UserPlus } from "lucide-react";
import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { SearchInput } from "@/components/ui/Controls";
import { TIPSTERS } from "@/lib/data";

export function TipstersView() {
  const [query, setQuery] = useState("");
  const [following, setFollowing] = useState<Set<string>>(new Set(["Dolly Krista", "Leo Park"]));

  const list = TIPSTERS.filter((t) => `${t.name} ${t.specialty}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="space-y-6">
      <SearchInput value={query} onChange={setQuery} placeholder="Search tipsters or sports…" />

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {list.map((t, i) => {
          const isFollowing = following.has(t.name);
          const c = 2 * Math.PI * 26;
          return (
            <div key={t.name} style={{ animationDelay: `${i * 60}ms` }} className="neu-card animate-rise group rounded-3xl p-5 text-center">
              <div className="relative mx-auto size-[72px]">
                <svg viewBox="0 0 60 60" className="absolute inset-0 -rotate-90">
                  <circle cx="30" cy="30" r="26" fill="none" stroke="var(--line)" strokeWidth="3" />
                  <circle
                    cx="30" cy="30" r="26" fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round"
                    strokeDasharray={c} strokeDashoffset={c * (1 - t.winRate / 100)}
                    className="transition-[stroke-dashoffset] duration-700 group-hover:stroke-[var(--brand-yellow)]"
                  />
                </svg>
                <div className="absolute inset-[9px] grid place-items-center">
                  <Avatar name={t.name} className="!size-full" />
                </div>
              </div>
              <div className="mt-3 font-display text-lg font-bold">{t.name}</div>
              <div className="text-xs text-muted">{t.specialty}</div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <Metric value={`${t.winRate}%`} label="Win rate" />
                <Metric value={`+${t.profit.toLocaleString()}`} label="Profit" tone="text-success" />
                <Metric value={`${(t.followers / 1000).toFixed(1)}k`} label="Fans" />
              </div>

              {t.streak > 0 && (
                <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-yellow/20 px-2.5 py-1 text-[11px] font-bold text-[#b88a00] dark:text-yellow">
                  <Flame className="size-3" /> {t.streak} win streak
                </div>
              )}

              <button
                onClick={() =>
                  setFollowing((s) => {
                    const n = new Set(s);
                    if (n.has(t.name)) n.delete(t.name);
                    else n.add(t.name);
                    return n;
                  })
                }
                className={`mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold transition-all duration-300 ${
                  isFollowing ? "neu-inset-sm text-primary" : "neu-btn"
                }`}
              >
                {isFollowing ? <UserCheck className="size-4" /> : <UserPlus className="size-4" />}
                {isFollowing ? "Following" : "Follow"}
              </button>
            </div>
          );
        })}
        {list.length === 0 && <p className="text-sm text-muted">No tipsters match “{query}”.</p>}
      </div>
    </div>
  );
}

function Metric({ value, label, tone = "" }: { value: string; label: string; tone?: string }) {
  return (
    <div className="neu-inset-sm rounded-xl py-2">
      <div className={`text-sm font-bold ${tone}`}>{value}</div>
      <div className="text-[10px] text-muted">{label}</div>
    </div>
  );
}
