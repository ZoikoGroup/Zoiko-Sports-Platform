import { ArrowDown, ArrowUp, CalendarDays, Globe, Trophy, UsersRound, type LucideIcon } from 'lucide-react'
import type { Kpi, KpiId } from '../api/types'
import { formatCount } from '../format'

const KPI_STYLE: Record<KpiId, { icon: LucideIcon; tone: string }> = {
  'active-competitions': { icon: Trophy, tone: 'violet' },
  'total-events': { icon: CalendarDays, tone: 'blue' },
  'participating-organizations': { icon: UsersRound, tone: 'sky' },
  'countries-regions': { icon: Globe, tone: 'orange' },
}

export function KpiCards({ kpis }: { kpis: Kpi[] }) {
  return (
    <section className="org-kpis" aria-label="Key figures">
      {kpis.map((kpi) => {
        const { icon: Icon, tone } = KPI_STYLE[kpi.id]
        const change = kpi.changePercent
        return (
          <article key={kpi.id} className={`org-kpi org-kpi--${tone}`} data-testid={`kpi-${kpi.id}`}>
            <Icon className="org-kpi__icon" size={44} strokeWidth={1.7} aria-hidden="true" />
            <div className="org-kpi__body">
              <p className="org-kpi__value">{formatCount(kpi.value)}</p>
              <h2 className="org-kpi__label">{kpi.label}</h2>
            </div>
            {change !== undefined && (
              <p className={`org-kpi__delta${change < 0 ? ' is-down' : ''}`}>
                {change < 0 ? (
                  <ArrowDown size={15} strokeWidth={2.6} aria-hidden="true" />
                ) : (
                  <ArrowUp size={15} strokeWidth={2.6} aria-hidden="true" />
                )}
                <span className="visually-hidden">{change < 0 ? 'Down ' : 'Up '}</span>
                {change < 0 ? '−' : '+'}
                {Math.abs(change)}%<span className="visually-hidden"> on the previous period</span>
              </p>
            )}
          </article>
        )
      })}
    </section>
  )
}
