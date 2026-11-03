"use client";

import { ArrowRight, Eye, EyeOff, KeyRound, Lock, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/brand/Logo";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@zoikosports.com");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!EMAIL_RE.test(email)) return setError("Enter a valid email address.");
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    setError("");
    setLoading(true);
    // Demo sign-in: replace with a real auth call.
    setTimeout(() => router.push("/dashboard"), 1200);
  }

  return (
    <div className="neu animate-rise w-full max-w-[440px] rounded-[32px] p-8 sm:p-10">
      <div className="flex justify-center">
        <Logo className="h-14" priority />
      </div>

      <div className="mt-8 text-center">
        <h2 className="font-display text-2xl font-bold">Welcome back 👋</h2>
        <p className="mt-1 text-sm text-muted">Sign in to the Zoiko Sports admin console</p>
      </div>

      <form onSubmit={onSubmit} className="mt-8 space-y-5" noValidate>
        <Field icon={<Mail className="size-[18px]" />} label="Email">
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@zoikosports.com"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted/70"
          />
        </Field>

        <Field icon={<Lock className="size-[18px]" />} label="Password">
          <input
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted/70"
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="text-muted transition hover:scale-110 hover:text-primary"
          >
            {showPassword ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
          </button>
        </Field>

        <div className="flex items-center justify-between text-sm">
          <label className="flex cursor-pointer select-none items-center gap-3 text-muted">
            <button
              type="button"
              role="switch"
              aria-checked={remember}
              onClick={() => setRemember((r) => !r)}
              className="neu-inset-sm relative h-6 w-11 rounded-full"
            >
              <span
                className={`absolute top-1 size-4 rounded-full transition-all duration-300 ${
                  remember ? "left-6 bg-primary shadow-[0_0_10px_var(--primary)]" : "left-1 bg-muted/60"
                }`}
              />
            </button>
            Remember me
          </label>
          <a href="#" className="font-semibold text-primary underline-offset-4 hover:underline">
            Forgot password?
          </a>
        </div>

        {error && (
          <p role="alert" className="animate-rise rounded-xl bg-danger/10 px-4 py-2.5 text-sm font-medium text-danger">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="shine group flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-deep to-blue font-semibold text-white shadow-[6px_6px_16px_var(--sh-dark),-6px_-6px_16px_var(--sh-light)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgb(58_127_184/0.45)] active:translate-y-0 active:scale-[0.98] disabled:cursor-wait"
        >
          {loading ? (
            <>
              <span className="size-5 animate-spin rounded-full border-2 border-white/30 border-t-yellow" />
              Signing in…
            </>
          ) : (
            <>
              Sign in
              <ArrowRight className="size-5 transition-transform duration-300 group-hover:translate-x-1" />
            </>
          )}
        </button>

        <div className="flex items-center gap-3 text-xs uppercase tracking-widest text-muted">
          <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
        </div>

        <button
          type="button"
          className="neu-btn flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold"
        >
          <KeyRound className="size-[18px] text-yellow" />
          Continue with SSO
        </button>
      </form>

      <p className="mt-8 text-center text-xs text-muted">
        Demo: any valid email and a 6+ character password.
      </p>
    </div>
  );
}

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block pl-1 text-xs font-semibold uppercase tracking-wider text-muted">{label}</span>
      <span className="neu-inset flex h-13 items-center gap-3 rounded-2xl px-4 text-muted transition-shadow focus-within:text-primary focus-within:ring-2 focus-within:ring-primary/40">
        {icon}
        <span className="flex flex-1 items-center gap-2 text-ink">{children}</span>
      </span>
    </label>
  );
}
