"use client";

import { Bell, ChevronDown, Menu, Plus, Search, Wallet } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

const LEAGUE_CHIPS = [
  { code: "LL", color: "#ee3524", name: "LaLiga", slug: "laliga" },
  { code: "PL", color: "#3d195b", name: "Premier League", slug: "premier-league" },
  { code: "BL", color: "#d20515", name: "Bundesliga", slug: "bundesliga" },
];

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const clock = useClock();

  return (
    <header className="flex flex-wrap items-center gap-3 sm:gap-4">
      <button onClick={onMenu} aria-label="Open menu" className="neu-btn grid size-11 place-items-center rounded-2xl lg:hidden">
        <Menu className="size-5" />
      </button>

      <label className="neu-inset order-last flex h-11 w-full items-center gap-3 rounded-2xl px-4 text-muted transition focus-within:text-primary md:order-none md:w-auto md:min-w-[240px] md:flex-1 xl:max-w-sm">
        <Search className="size-[18px]" />
        <input placeholder="Search games, teams, tipsters…" className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted/70" />
        <kbd className="hidden rounded-md border border-line px-1.5 text-[10px] font-semibold sm:block">⌘K</kbd>
      </label>

      <div className="hidden items-center gap-3 sm:flex">
        {LEAGUE_CHIPS.map((l) => (
          <Link key={l.code} href={`/dashboard/leagues/${l.slug}`} title={l.name} className="neu-btn grid size-11 place-items-center rounded-full">
            <span className="grid size-7 place-items-center rounded-full text-[10px] font-black text-white" style={{ background: l.color }}>
              {l.code}
            </span>
          </Link>
        ))}
      </div>

      <div className="ml-auto flex items-center gap-3 sm:gap-4">
        <Link href="/dashboard/hot-tips" className="shine group flex h-11 items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-deep to-blue px-5 text-sm font-semibold text-white shadow-[4px_4px_12px_var(--sh-dark)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgb(58_127_184/0.45)] active:scale-95">
          <Plus className="size-4 transition-transform duration-300 group-hover:rotate-90" />
          <span className="hidden sm:inline">Add Tips</span>
        </Link>

        <div className="hidden items-center gap-2.5 xl:flex">
          <span className="grid size-10 place-items-center rounded-xl bg-success/15 text-success">
            <Wallet className="size-5" />
          </span>
          <div className="leading-tight">
            <div className="font-display font-bold">4,789</div>
            <div className="flex items-center text-[11px] text-muted">
              ROI <ChevronDown className="size-3" />
            </div>
          </div>
        </div>

        <Link href="/dashboard/feed" aria-label="Notifications" className="neu-btn group relative grid size-11 place-items-center rounded-2xl">
          <Bell className="size-5 origin-top group-hover:[animation:wiggle_0.6s_ease-in-out]" />
          <span className="absolute right-2.5 top-2.5 size-2 rounded-full bg-danger animate-live" />
        </Link>

        <button className="neu-btn hidden h-11 items-center gap-2 rounded-2xl px-4 text-sm font-semibold md:flex">
          <span className="tabular-nums">{clock?.time ?? "--:--"}</span>
          <span className="text-muted">({clock?.zone ?? "GMT"})</span>
          <ChevronDown className="size-4 text-muted" />
        </button>

        <ThemeToggle />
      </div>
    </header>
  );
}

function useClock() {
  const [clock, setClock] = useState<{ time: string; zone: string } | null>(null);
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const mins = -now.getTimezoneOffset();
      const hh = Math.trunc(Math.abs(mins) / 60);
      const mm = Math.abs(mins) % 60;
      setClock({
        time: now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
        zone: `GMT${mins >= 0 ? "+" : "-"}${hh}${mm ? `:${String(mm).padStart(2, "0")}` : ""}`,
      });
    };
    tick();
    const id = setInterval(tick, 15_000);
    return () => clearInterval(id);
  }, []);
  return clock;
}
