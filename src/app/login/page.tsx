import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/LoginForm";
import { BrandBall } from "@/components/brand/BrandBall";
import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export const metadata: Metadata = { title: "Sign in" };

const STATS = [
  { value: "12.4k", label: "Active tipsters" },
  { value: "380+", label: "Live matches / wk" },
  { value: "98.2%", label: "Uptime" },
];

export default function LoginPage() {
  return (
    <main className="relative flex min-h-dvh items-stretch">
      {/* Brand panel */}
      <section className="animate-gradient relative hidden w-[46%] overflow-hidden bg-[linear-gradient(135deg,#25163a,#2a6597,#3a7fb8,#25163a)] p-12 text-white lg:flex lg:flex-col">
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute -right-24 -top-24 size-96 rounded-full border-[40px] border-white/5" />
          <div className="absolute -bottom-32 -left-20 size-[28rem] rounded-full border-[56px] border-yellow/10" />
          <BrandBall className="animate-float absolute right-16 top-1/3 size-40 drop-shadow-[0_30px_40px_rgba(0,0,0,0.45)]" />
          <BrandBall className="animate-float absolute bottom-24 right-48 size-14 opacity-70 [animation-delay:-2s]" />
          <BrandBall className="animate-float absolute left-[45%] top-20 size-8 opacity-50 [animation-delay:-4s]" />
        </div>

        <div className="relative flex items-center gap-3">
          <Logo variant="icon" className="size-12 shadow-lg" priority />
          <div className="font-display leading-none">
            <div className="text-2xl font-extrabold tracking-wide">ZOIKO</div>
            <div className="text-xs font-bold tracking-[0.4em] text-yellow">SPORTS</div>
          </div>
        </div>

        <div className="relative mt-auto max-w-md">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur">
            <span className="size-2 rounded-full bg-yellow" /> Admin Console
          </span>
          <h1 className="mt-5 font-display text-5xl font-extrabold leading-[1.05]">
            Run the game,
            <br />
            <span className="text-yellow">every match day.</span>
          </h1>
          <p className="mt-4 text-white/70">
            Manage fixtures, tipsters, payouts and live feeds from one place.
          </p>

          <div className="mt-10 grid grid-cols-3 gap-3">
            {STATS.map((s) => (
              <div
                key={s.label}
                className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur transition hover:-translate-y-1 hover:bg-white/10"
              >
                <div className="font-display text-2xl font-bold">{s.value}</div>
                <div className="mt-1 text-xs text-white/60">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Form panel */}
      <section className="relative flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
        <div className="absolute right-4 top-4 sm:right-8 sm:top-8">
          <ThemeToggle />
        </div>
        <LoginForm />
      </section>
    </main>
  );
}
