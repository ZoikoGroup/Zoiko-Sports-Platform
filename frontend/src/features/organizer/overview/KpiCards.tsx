import { ArrowDown, ArrowUp, Globe, Radio, Trophy, UsersRound, type LucideIcon } from 'lucide-react'
import type { Kpi, KpiId } from '../api/types'
import { formatCount } from '../format'

const KPI_STYLE: Record<KpiId, { icon: LucideIcon; tone: string }> = {
  'active-competitions': { icon: Trophy, tone: 'blue' },
  'live-events': { icon: Radio, tone: 'violet' },
  'participating-organizations': { icon: UsersRound, tone: 'green' },
  'countries-regions': { icon: Globe, tone: 'orange' },
}

export function KpiCards({ kpis }: { kpis: Kpi[] }) {
  return (
    <section className="org-kpis" aria-label="Key figures">
      {kpis.map((kpi) => {
        const { icon: Icon, tone } = KPI_STYLE[kpi.id]
        return (
          <article key={kpi.id} className={`org-kpi org-kpi--${tone}`} data-testid={`kpi-${kpi.id}`}>
            <span className="org-kpi__icon" aria-hidden="true">
              <Icon size={34} strokeWidth={1.8} />
            </span>
            <div className="org-kpi__body">
              <p className="org-kpi__value">{formatCount(kpi.value)}</p>
              <h2 className="org-kpi__label">{kpi.label}</h2>
            </div>
            {kpi.change && (
              <p className="org-kpi__change">
                <span className={`org-kpi__delta${kpi.change.percent < 0 ? ' is-down' : ''}`}>
                  {kpi.change.percent < 0 ? (
                    <ArrowDown size={16} strokeWidth={2.6} aria-hidden="true" />
                  ) : (
                    <ArrowUp size={16} strokeWidth={2.6} aria-hidden="true" />
                  )}
                  <span className="visually-hidden">{kpi.change.percent < 0 ? 'Down ' : 'Up '}</span>
                  {kpi.change.percent < 0 ? '−' : '+'}
                  {Math.abs(kpi.change.percent)}%
                </span>
                <span className="org-kpi__compare">vs. {kpi.change.comparedTo}</span>
              </p>
            )}
          </article>
        )
      })}
    </section>
  )
}
