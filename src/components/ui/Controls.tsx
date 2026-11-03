"use client";

import { Search } from "lucide-react";

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="neu-inset-sm relative h-7 w-12 shrink-0 rounded-full"
    >
      <span
        className={`absolute top-1 size-5 rounded-full transition-all duration-300 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)] ${
          checked ? "left-6 bg-primary shadow-[0_0_10px_var(--primary)]" : "left-1 bg-muted/60"
        }`}
      />
    </button>
  );
}

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="neu-inset flex h-11 w-full items-center gap-3 rounded-2xl px-4 text-muted transition focus-within:text-primary sm:w-72">
      <Search className="size-[18px]" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted/70"
      />
    </label>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="neu-inset-sm flex gap-1 overflow-x-auto rounded-2xl p-1.5">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`shrink-0 rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-300 ${
            value === o.id
              ? "bg-gradient-to-r from-blue-deep to-blue text-white shadow-[0_6px_16px_rgb(58_127_184/0.35)]"
              : "text-muted hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const BADGE = {
  active: "bg-success/15 text-success",
  approved: "bg-success/15 text-success",
  pending: "bg-yellow/20 text-[#b88a00] dark:text-yellow",
  suspended: "bg-danger/15 text-danger",
  rejected: "bg-danger/15 text-danger",
};

export function StatusBadge({ status }: { status: keyof typeof BADGE }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ${BADGE[status]}`}>
      <span className="size-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}
