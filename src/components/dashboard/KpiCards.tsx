"use client";

import { Activity, DollarSign, Target, TrendingDown, TrendingUp, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { KPIS } from "@/lib/data";

const ICONS = [Users, Activity, DollarSign, Target];
const TINTS = ["text-primary", "text-yellow", "text-success", "text-[#a78bfa]"];

export function KpiCards() {
  return (
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      {KPIS.map((k, i) => {
        const Icon = ICONS[i];
        const up = k.delta >= 0;
        return (
          <div key={k.label} className="neu-card shine group rounded-3xl p-4">
            <div className="flex items-center justify-between">
              <span className={`neu-inset-sm grid size-10 place-items-center rounded-xl ${TINTS[i]} transition-transform duration-500 group-hover:rotate-[360deg]`}>
                <Icon className="size-5" />
              </span>
              <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${up ? "bg-success/15 text-success" : "bg-danger/15 text-danger"}`}>
                {up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                {Math.abs(k.delta)}%
              </span>
            </div>
            <div className="mt-3 font-display text-2xl font-bold tabular-nums">
              <CountUp value={k.value} decimals={k.value % 1 ? 1 : 0} />
              {k.suffix}
            </div>
            <div className="text-xs text-muted">{k.label}</div>
          </div>
        );
      })}
    </div>
  );
}

function CountUp({ value, decimals }: { value: number; decimals: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const step = (t: number) => {
      const p = Math.min((t - start) / 1400, 1);
      setN(value * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}</>;
}
