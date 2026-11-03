import { ChevronRight } from "lucide-react";
import Link from "next/link";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  crumb?: string;
  actions?: React.ReactNode;
};

export function PageHeader({ title, subtitle, crumb, actions }: PageHeaderProps) {
  return (
    <div className="animate-rise mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <nav className="flex items-center gap-1 text-xs font-semibold text-muted">
          <Link href="/dashboard" className="transition hover:text-primary">
            Dashboard
          </Link>
          <ChevronRight className="size-3" />
          <span className="text-primary">{crumb ?? title}</span>
        </nav>
        <h1 className="mt-1 font-display text-3xl font-bold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}
