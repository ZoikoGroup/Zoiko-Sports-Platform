"use client";

import { Bell, CheckCircle2, Palette, Shield, User } from "lucide-react";
import { useState } from "react";
import { useTheme } from "@/components/theme/ThemeProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Switch } from "@/components/ui/Controls";
import { primaryBtn } from "@/lib/styles";

export function SettingsView() {
  const { theme, toggleTheme } = useTheme();
  const [profile, setProfile] = useState({ name: "Max Kembli", email: "max@zoikosports.com", role: "Super Admin" });
  const [prefs, setPrefs] = useState({ email: true, push: true, live: false, payouts: true, twoFactor: true, sessions: false });
  const [saved, setSaved] = useState(false);

  const setPref = (k: keyof typeof prefs) => (v: boolean) => setPrefs((p) => ({ ...p, [k]: v }));

  function save(e: React.FormEvent) {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  }

  return (
    <form onSubmit={save} className="grid gap-7 xl:grid-cols-2">
      <Card icon={<User className="size-5" />} title="Profile">
        <div className="flex items-center gap-4">
          <Avatar name={profile.name} size="lg" online />
          <div>
            <div className="font-display text-lg font-bold">{profile.name}</div>
            <div className="text-xs text-muted">{profile.role}</div>
          </div>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Input label="Full name" value={profile.name} onChange={(v) => setProfile({ ...profile, name: v })} />
          <Input label="Email" value={profile.email} onChange={(v) => setProfile({ ...profile, email: v })} />
        </div>
      </Card>

      <Card icon={<Palette className="size-5" />} title="Appearance">
        <Pref title="Dark theme" desc="Switch between light and dark neumorphic themes.">
          <Switch label="Dark theme" checked={theme === "dark"} onChange={() => toggleTheme()} />
        </Pref>
      </Card>

      <Card icon={<Bell className="size-5" />} title="Notifications">
        <Pref title="Email digests" desc="Daily summary of tips and results.">
          <Switch label="Email digests" checked={prefs.email} onChange={setPref("email")} />
        </Pref>
        <Pref title="Push notifications" desc="Alerts for new tips from people you follow.">
          <Switch label="Push notifications" checked={prefs.push} onChange={setPref("push")} />
        </Pref>
        <Pref title="Live match alerts" desc="Goals and full-time results.">
          <Switch label="Live match alerts" checked={prefs.live} onChange={setPref("live")} />
        </Pref>
        <Pref title="Payout requests" desc="Notify me when a payout needs approval.">
          <Switch label="Payout requests" checked={prefs.payouts} onChange={setPref("payouts")} />
        </Pref>
      </Card>

      <Card icon={<Shield className="size-5" />} title="Security">
        <Pref title="Two-factor authentication" desc="Require a code at sign-in.">
          <Switch label="Two-factor authentication" checked={prefs.twoFactor} onChange={setPref("twoFactor")} />
        </Pref>
        <Pref title="Sign out other sessions" desc="End sessions on other devices after saving.">
          <Switch label="Sign out other sessions" checked={prefs.sessions} onChange={setPref("sessions")} />
        </Pref>
      </Card>

      <div className="flex items-center gap-4 xl:col-span-2">
        <button type="submit" className={primaryBtn}>Save changes</button>
        {saved && (
          <span role="status" className="animate-rise flex items-center gap-2 text-sm font-semibold text-success">
            <CheckCircle2 className="size-4" /> Saved
          </span>
        )}
      </div>
    </form>
  );
}

function Card({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="neu animate-rise rounded-3xl p-6">
      <h2 className="mb-5 flex items-center gap-3 font-display text-lg font-bold">
        <span className="neu-inset-sm grid size-9 place-items-center rounded-xl text-primary">{icon}</span>
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Pref({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-muted">{desc}</div>
      </div>
      {children}
    </div>
  );
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-2 block pl-1 text-xs font-semibold uppercase tracking-wider text-muted">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="neu-inset h-11 w-full rounded-2xl bg-transparent px-4 text-sm outline-none transition focus:ring-2 focus:ring-primary/40"
      />
    </label>
  );
}
