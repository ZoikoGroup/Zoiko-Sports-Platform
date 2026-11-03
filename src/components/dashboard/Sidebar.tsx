"use client";

import {
  ChevronsLeft,
  Filter,
  Flame,
  LayoutDashboard,
  LogOut,
  Newspaper,
  Plus,
  Settings,
  ShieldCheck,
  Users,
  Wallet,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { CLUBS, LEAGUES } from "@/lib/data";

const NAV = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "My Feed", href: "/dashboard/feed", icon: Newspaper },
  { label: "Tipsters", href: "/dashboard/tipsters", icon: Filter },
  { label: "Hot Tips", href: "/dashboard/hot-tips", icon: Flame, badge: "12" },
  { label: "Users", href: "/dashboard/users", icon: Users },
  { label: "Payouts", href: "/dashboard/payouts", icon: Wallet },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

type SidebarProps = {
  open: boolean;
  collapsed: boolean;
  onClose: () => void;
  onToggleCollapse: () => void;
};

type Tip = { label: string; y: number } | null;

export function Sidebar({ open, collapsed, onClose, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();
  const [tip, setTip] = useState<Tip>(null);
  const [favLeagues, setFavLeagues] = useState(["premier-league", "i-league", "laliga"]);
  const [favClubs, setFavClubs] = useState(["tsg-hoffenheim"]);

  // Collapsed state only applies to the desktop rail; the mobile drawer is always full width.
  const hide = collapsed ? "lg:hidden" : "";

  const isActive = (href: string) => (href === "/dashboard" ? pathname === href : pathname.startsWith(href));

  // Tooltips are fixed-positioned so the scrolling rail doesn't clip them.
  const tipProps = (label: string) =>
    collapsed
      ? {
          onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
            const r = e.currentTarget.getBoundingClientRect();
            setTip({ label, y: r.top + r.height / 2 });
          },
          onMouseLeave: () => setTip(null),
        }
      : {};

  return (
    <>
      {/* mobile backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-30 bg-navy/40 backdrop-blur-sm transition-opacity lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        onScroll={() => setTip(null)}
        className={`fixed inset-y-0 left-0 z-40 flex w-[280px] shrink-0 flex-col overflow-y-auto overflow-x-hidden bg-bg pb-6 pt-6 transition-[width,transform,padding] duration-500 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0 ${
          open ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        } ${collapsed ? "px-5 lg:w-[96px] lg:px-4" : "px-5"}`}
      >
        {/* header */}
        <div className={`flex items-center justify-between gap-2 px-1 ${collapsed ? "lg:flex-col lg:px-0" : ""}`}>
          <Link href="/dashboard" onClick={onClose} className="transition-transform hover:scale-105">
            {collapsed ? (
              <>
                <Logo className="h-10 lg:hidden" priority />
                <Logo variant="icon" className="hidden size-11 lg:block" />
              </>
            ) : (
              <Logo className="h-10" priority />
            )}
          </Link>
          <button onClick={onClose} aria-label="Close menu" className="neu-btn grid size-9 place-items-center rounded-xl lg:hidden">
            <X className="size-4" />
          </button>
          <button
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={`${collapsed ? "Expand" : "Collapse"} sidebar (Ctrl+B)`}
            className={`neu-btn hidden size-9 shrink-0 place-items-center rounded-xl lg:grid ${collapsed ? "lg:mt-4" : ""}`}
          >
            <ChevronsLeft className={`size-4 transition-transform duration-500 ${collapsed ? "rotate-180" : ""}`} />
          </button>
        </div>

        {/* admin */}
        <Link
          href="/dashboard/settings"
          onClick={onClose}
          {...tipProps("Admin")}
          className={`neu-btn mt-7 flex items-center gap-3 rounded-2xl p-2.5 ${collapsed ? "lg:justify-center" : ""}`}
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-blue to-blue-deep text-white">
            <ShieldCheck className="size-[18px]" />
          </span>
          <span className={`font-display font-bold ${hide}`}>Admin</span>
        </Link>

        <nav className="mt-7 space-y-1.5">
          {NAV.map(({ label, href, icon: Icon, badge }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                aria-current={active ? "page" : undefined}
                aria-label={label}
                {...tipProps(label)}
                className={`group relative flex w-full items-center gap-3.5 rounded-2xl px-4 py-3 text-sm font-semibold transition-all duration-300 ${
                  active ? "neu-inset text-primary" : "text-muted hover:text-ink"
                } ${collapsed ? "lg:justify-center lg:px-0" : active ? "" : "hover:translate-x-1"}`}
              >
                <span
                  className={`absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-blue to-yellow transition-opacity ${
                    active ? "opacity-100" : "opacity-0"
                  }`}
                />
                <Icon className={`size-[19px] shrink-0 transition-transform duration-300 ${active ? "" : "group-hover:-rotate-12 group-hover:scale-110"}`} />
                <span className={`whitespace-nowrap ${hide}`}>{label}</span>
                {badge && (
                  <>
                    <span className={`ml-auto rounded-full bg-yellow px-2 py-0.5 text-[10px] font-bold text-navy ${hide}`}>{badge}</span>
                    {collapsed && <span className="absolute right-3 top-2 hidden size-2 rounded-full bg-yellow lg:block" />}
                  </>
                )}
              </Link>
            );
          })}
        </nav>

        <Section
          title="Favourite League"
          collapsed={collapsed}
          options={LEAGUES.filter((l) => !favLeagues.includes(l.slug)).map((l) => ({ id: l.slug, label: l.name }))}
          onAdd={(id) => setFavLeagues((f) => [...f, id])}
        >
          {favLeagues.map((slug) => {
            const l = LEAGUES.find((x) => x.slug === slug)!;
            const href = `/dashboard/leagues/${l.slug}`;
            return (
              <Row key={slug} href={href} active={isActive(href)} collapsed={collapsed} onClick={onClose} {...tipProps(l.name)}>
                <span className="grid size-7 shrink-0 place-items-center rounded-lg text-[9px] font-black text-white" style={{ background: l.color }}>
                  {l.code}
                </span>
                <span className={`truncate ${hide}`}>{l.name}</span>
              </Row>
            );
          })}
        </Section>

        <Section
          title="Favourite Club"
          collapsed={collapsed}
          options={CLUBS.filter((c) => !favClubs.includes(c.slug)).map((c) => ({ id: c.slug, label: c.team.name }))}
          onAdd={(id) => setFavClubs((f) => [...f, id])}
        >
          {favClubs.map((slug) => {
            const c = CLUBS.find((x) => x.slug === slug)!;
            const href = `/dashboard/clubs/${c.slug}`;
            return (
              <Row key={slug} href={href} active={isActive(href)} collapsed={collapsed} onClick={onClose} {...tipProps(c.team.name)}>
                <span className="grid size-7 shrink-0 place-items-center rounded-lg text-[9px] font-black text-white" style={{ background: c.team.colors[0], color: c.team.colors[0] === "#fde100" ? "#000" : undefined }}>
                  {c.team.code}
                </span>
                <span className={`truncate ${hide}`}>{c.team.name}</span>
              </Row>
            );
          })}
        </Section>

        <div className="mt-auto pt-8">
          <Link
            href="/login"
            {...tipProps("Log out")}
            className="neu-btn flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold text-danger hover:!text-danger"
          >
            <LogOut className="size-4 shrink-0" /> <span className={hide}>Log out</span>
          </Link>
        </div>
      </aside>

      {collapsed && tip && (
        <div
          role="tooltip"
          style={{ top: tip.y }}
          className="animate-rise pointer-events-none fixed left-[104px] z-50 hidden -translate-y-1/2 whitespace-nowrap rounded-xl bg-navy px-3 py-1.5 text-xs font-semibold text-white shadow-xl [animation-duration:0.25s] lg:block dark:bg-primary"
        >
          <span className="absolute -left-1 top-1/2 size-2 -translate-y-1/2 rotate-45 bg-inherit" />
          {tip.label}
        </div>
      )}
    </>
  );
}

type SectionProps = {
  title: string;
  collapsed: boolean;
  options: { id: string; label: string }[];
  onAdd: (id: string) => void;
  children: React.ReactNode;
};

function Section({ title, collapsed, options, onAdd, children }: SectionProps) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="mt-7">
      <div className={`mb-2 flex items-center justify-between px-2 ${collapsed ? "lg:hidden" : ""}`}>
        <span className="text-xs font-bold uppercase tracking-wider text-muted">{title}</span>
        <button
          onClick={() => setAdding((a) => !a)}
          disabled={options.length === 0}
          aria-expanded={adding}
          aria-label={`Add ${title}`}
          className={`neu-btn grid size-6 place-items-center rounded-full text-yellow disabled:opacity-40 ${adding ? "rotate-45" : "hover:rotate-90"}`}
        >
          <Plus className="size-3.5" />
        </button>
      </div>
      {collapsed && <div className="mx-auto mb-3 hidden h-px w-8 bg-line lg:block" />}

      {adding && !collapsed && options.length > 0 && (
        <div className="neu-inset-sm animate-rise mb-2 space-y-1 rounded-2xl p-2 [animation-duration:0.3s]">
          {options.map((o) => (
            <button
              key={o.id}
              onClick={() => {
                onAdd(o.id);
                setAdding(false);
              }}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold text-muted transition hover:bg-primary/10 hover:text-primary"
            >
              <Plus className="size-3" /> {o.label}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-1">{children}</div>
    </div>
  );
}

type RowProps = {
  href: string;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLAnchorElement>;

function Row({ href, active, collapsed, children, ...rest }: RowProps) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      {...rest}
      className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-sm font-medium transition-all duration-300 ${
        active ? "neu-inset-sm text-primary" : "hover:text-primary"
      } ${collapsed ? "lg:justify-center lg:px-0" : active ? "" : "hover:translate-x-1"}`}
    >
      {children}
    </Link>
  );
}
