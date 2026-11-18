import { ArrowRight, CircleAlert, TriangleAlert, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { OperationalAlert } from '../api/types'
import { formatAgo } from '../format'
import { organizerPath } from '../navigation'

interface OperationalAlertsProps {
  alerts: OperationalAlert[]
  now: Date
  /** Where "View All" leads, and the count shown beside it. */
  viewAll?: { to: string; count?: number }
  /** Header icon (the Action Center uses a bell). */
  icon?: LucideIcon
}

export function OperationalAlerts({ alerts, now, viewAll = { to: organizerPath('action-center') }, icon: Icon = TriangleAlert }: OperationalAlertsProps) {
  return (
    <section className="org-card org-alerts" aria-labelledby="org-alerts-title">
      <header className="org-card__head">
        <Icon className="org-card__icon" size={26} aria-hidden="true" />
        <h2 id="org-alerts-title" className="org-card__title">
          Operational Alerts
        </h2>
        <Link className="org-card__link" to={viewAll.to}>
          View All{viewAll.count !== undefined && ` (${viewAll.count})`} <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </header>
      {alerts.length === 0 ? (
        <p className="org-empty">No open alerts.</p>
      ) : (
        <ul className="org-list">
          {alerts.slice(0, 3).map((alert) => (
            <li key={alert.id} className="org-list__row">
              {alert.severity === 'critical' ? (
                <CircleAlert className="org-alerts__icon is-critical" size={22} aria-label="Critical" />
              ) : (
                <TriangleAlert className="org-alerts__icon is-warning" size={22} aria-label="Warning" />
              )}
              <span className="org-list__text">{alert.title}</span>
              <time className="org-list__meta" dateTime={alert.createdAt}>
                {formatAgo(alert.createdAt, now)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
