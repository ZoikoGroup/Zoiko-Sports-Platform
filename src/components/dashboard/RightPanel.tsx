"use client";

import { ArrowUpRight, CircleDollarSign, Lightbulb, Wallet } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Crest } from "@/components/ui/Crest";
import { BALANCE_SERIES, FOLLOWING, NOTIFICATIONS, TEAMS } from "@/lib/data";

export function TopFollowing() {
  return (
    <section className="neu rounded-3xl p-5">
      <Header title="Top Following" action="All" href="/dashboard/tipsters" />
      <div className="mt-4 grid grid-cols-5 gap-3">
        {FOLLOWING.map((name, i) => (
          <Link
            key={name}
            href="/dashboard/tipsters"
            title={name}
            style={{ animationDelay: `${i * 50}ms` }}
            className="animate-rise group relative mx-auto rounded-full p-[3px] transition-transform duration-300 hover:-translate-y-1.5 hover:scale-110"
          >
            <span className="absolute inset-0 rounded-full bg-gradient-to-tr from-blue to-yellow opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <Avatar name={name} online={i % 3 === 0} className="relative ring-2 ring-surface" />
          </Link>
        ))}
      </div>
    </section>
  );
}

const W = 300;
const H = 120;

export function BalanceCard() {
  const [hover, setHover] = useState<number | null>(null);
  const last = BALANCE_SERIES.length - 1;
  const active = hover ?? last;

  const { points, line, area } = useMemo(() => {
    const vals = BALANCE_SERIES.map((d) => d.value);
    const min = Math.min(...vals) - 15;
    const max = Math.max(...vals) + 15;
    const pts = vals.map((v, i) => [(i / last) * W, H - ((v - min) / (max - min)) * H] as const);
    // Catmull-Rom → cubic Bézier for a smooth line
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] ?? pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] ?? p2;
      d += ` C${p1[0] + (p2[0] - p0[0]) / 6},${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6},${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]},${p2[1]}`;
    }
    return { points: pts, line: d, area: `${d} L${W},${H} L0,${H} Z` };
  }, [last]);

  const cur = BALANCE_SERIES[active];
  const prev = BALANCE_SERIES[Math.max(active - 1, 0)];
  const change = cur.value - prev.value;

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - rect.left) / rect.width) * last);
    setHover(Math.max(0, Math.min(last, i)));
  }

  return (
    <section className="neu rounded-3xl p-5">
      <div className="flex items-baseline justify-between">
        <h3 className="font-display text-lg font-bold">Your Balance</h3>
        <span className="font-display text-2xl font-bold tabular-nums">{cur.value.toFixed(2).replace(".", ",")}</span>
      </div>
      <div className="mt-1 flex items-center justify-between text-xs text-muted">
        <span>{cur.label}, 2026</span>
        <span className={`flex items-center gap-0.5 font-bold ${change >= 0 ? "text-success" : "text-danger"}`}>
          <ArrowUpRight className={`size-3.5 ${change < 0 ? "rotate-90" : ""}`} />
          {change >= 0 ? "+" : ""}
          {change.toFixed(2)}
        </span>
      </div>

      <svg
        viewBox={`0 -12 ${W} ${H + 24}`}
        className="mt-3 w-full cursor-crosshair touch-none overflow-visible"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        role="img"
        aria-label={`Balance trend, latest ${BALANCE_SERIES[last].value}`}
      >
        <defs>
          <linearGradient id="bal-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--primary)" stopOpacity="0.35" />
            <stop offset="1" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="bal-line" x1="0" x2="1">
            <stop offset="0" stopColor="var(--brand-blue)" />
            <stop offset="1" stopColor="var(--brand-yellow)" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} stroke="var(--line)" strokeDasharray="3 5" />
        ))}
        <path d={area} fill="url(#bal-fill)" className="animate-rise" />
        <path
          d={line}
          fill="none"
          stroke="url(#bal-line)"
          strokeWidth="2.5"
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray="1"
          className="[animation:draw-line_1.6s_cubic-bezier(0.22,1,0.36,1)_both] [--len:1]"
        />
        <line x1={points[active][0]} x2={points[active][0]} y1={points[active][1]} y2={H} stroke="var(--success)" strokeDasharray="3 3" />
        <circle cx={points[active][0]} cy={points[active][1]} r="9" fill="var(--success)" opacity="0.2" className="animate-pulse" />
        <circle cx={points[active][0]} cy={points[active][1]} r="4.5" fill="var(--surface)" stroke="var(--success)" strokeWidth="2.5" />
      </svg>

      <div className="neu-inset-sm mt-4 rounded-2xl p-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted">16:01, 12 Oct 2026</span>
          <span className="font-bold text-success">+1,049</span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <Avatar name="Max Kembli" size="xs" /> Max Kembli
          </span>
          <span className="flex items-center gap-1.5 text-[10px] font-bold text-muted">
            <Crest team={TEAMS.vll} className="size-5" /> VS <Crest team={TEAMS.mll} className="size-5" />
          </span>
        </div>
      </div>
    </section>
  );
}

const TONE_ICON = {
  success: { Icon: CircleDollarSign, cls: "bg-success/15 text-success" },
  info: { Icon: Lightbulb, cls: "bg-primary/15 text-primary" },
  warn: { Icon: Wallet, cls: "bg-yellow/20 text-[#c99a00] dark:text-yellow" },
};

export function Notifications() {
  return (
    <section>
      <Header title="Notification" action="All Feed" href="/dashboard/feed" />
      <ul className="mt-4 space-y-3">
        {NOTIFICATIONS.map((n, i) => {
          const { Icon, cls } = TONE_ICON[n.tone];
          return (
            <li key={n.name} style={{ animationDelay: `${i * 80}ms` }} className="animate-rise">
              <Link href="/dashboard/feed" className="neu-card group flex items-center gap-3 rounded-2xl p-3">
              <div className="relative">
                <Avatar name={n.name} size="md" />
                <span className={`absolute -bottom-1 -right-1 grid size-5 place-items-center rounded-full ring-2 ring-surface ${cls}`}>
                  <Icon className="size-3" />
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold transition-colors group-hover:text-primary">{n.name}</div>
                <div className="truncate text-xs text-muted">{n.text}</div>
              </div>
              <span className="self-start text-[10px] text-muted">{n.time}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Header({ title, action, href }: { title: string; action: string; href: string }) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="font-display text-lg font-bold">{title}</h3>
      <Link href={href} className="text-xs font-semibold text-muted underline-offset-4 transition hover:text-primary hover:underline">
        {action}
      </Link>
    </div>
  );
}
