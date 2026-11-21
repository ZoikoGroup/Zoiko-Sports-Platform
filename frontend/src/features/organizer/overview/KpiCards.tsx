import { ArrowDown, ArrowUp, CalendarDays, Globe, Trophy, UsersRound, type LucideIcon } from 'lucide-react'
import type { KpiId, KpiValue } from '../api/types'
import { Metric } from '../components/DataState'

/** The Overview design's four headline figures, in order. Values come from the server. */
const KPIS: { id: KpiId; label: string; icon: LucideIcon; tone: string }[] = [
  { id: 'active-competitions', label: 'Active Competitions', icon: Trophy, tone: 'violet' },
  { id: 'total-events', label: 'Total Events', icon: CalendarDays, tone: 'blue' },
  { id: 'participating-organizations', label: 'Participating Organizations', icon: UsersRound, tone: 'sky' },
  { id: 'countries-regions', label: 'Countries / Regions', icon: Globe, tone: 'orange' },
]

export function KpiCards({ kpis }: { kpis: Partial<Record<KpiId, KpiValue>> }) {
  return (
    <section className="org-kpis" aria-label="Key figures">
      {KPIS.map(({ id, label, icon: Icon, tone }) => {
        const kpi = kpis[id]
        const change = kpi?.changePercent
        return (
          <article key={id} className={`org-kpi org-kpi--${tone}`} data-testid={`kpi-${id}`}>
            <Icon className="org-kpi__icon" size={44} strokeWidth={1.7} aria-hidden="true" />
            <div className="org-kpi__body">
              <p className="org-kpi__value">
                <Metric value={kpi?.value} />
              </p>
              <h2 className="org-kpi__label">{label}</h2>
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
