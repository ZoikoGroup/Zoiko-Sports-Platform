"use client";

import { Check, Clock, Wallet, X } from "lucide-react";
import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { StatusBadge } from "@/components/ui/Controls";
import { PAYOUTS, type PayoutStatus } from "@/lib/data";

export function PayoutsView() {
  const [payouts, setPayouts] = useState(PAYOUTS);

  const sum = (s: PayoutStatus) => payouts.filter((p) => p.status === s).reduce((a, p) => a + p.amount, 0);
  const setStatus = (id: string, status: PayoutStatus) =>
    setPayouts((list) => list.map((p) => (p.id === id ? { ...p, status } : p)));

  const cards = [
    { label: "Pending", value: sum("pending"), icon: Clock, tint: "text-[#b88a00] dark:text-yellow" },
    { label: "Approved", value: sum("approved"), icon: Check, tint: "text-success" },
    { label: "Rejected", value: sum("rejected"), icon: X, tint: "text-danger" },
  ];

  return (
    <div className="space-y-7">
      <div className="grid gap-5 sm:grid-cols-3">
        {cards.map(({ label, value, icon: Icon, tint }, i) => (
          <div key={label} style={{ animationDelay: `${i * 80}ms` }} className="neu-card shine animate-rise group rounded-3xl p-5">
            <span className={`neu-inset-sm grid size-10 place-items-center rounded-xl ${tint} transition-transform duration-500 group-hover:rotate-[360deg]`}>
              <Icon className="size-5" />
            </span>
            <div className="mt-3 font-display text-2xl font-bold tabular-nums">{value.toLocaleString()}</div>
            <div className="text-xs text-muted">{label} payouts</div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {payouts.map((p, i) => (
          <div
            key={p.id}
            style={{ animationDelay: `${i * 60}ms` }}
            className="neu-card animate-rise flex flex-wrap items-center gap-4 rounded-2xl px-5 py-4"
          >
            <Avatar name={p.name} size="md" />
            <div className="min-w-[140px] flex-1">
              <div className="font-semibold">{p.name}</div>
              <div className="text-xs text-muted">
                {p.id} · {p.requested}
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted">
              <Wallet className="size-4" /> {p.method}
            </div>
            <div className="w-24 text-right font-display text-lg font-bold tabular-nums">{p.amount.toLocaleString()}</div>
            <div className="w-28"><StatusBadge status={p.status} /></div>
            <div className="flex gap-2">
              {p.status === "pending" ? (
                <>
                  <button onClick={() => setStatus(p.id, "approved")} className="neu-btn flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold !text-success">
                    <Check className="size-4" /> Approve
                  </button>
                  <button onClick={() => setStatus(p.id, "rejected")} className="neu-btn flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold !text-danger">
                    <X className="size-4" /> Reject
                  </button>
                </>
              ) : (
                <button onClick={() => setStatus(p.id, "pending")} className="neu-btn h-9 rounded-xl px-3 text-xs font-semibold text-muted">
                  Undo
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
