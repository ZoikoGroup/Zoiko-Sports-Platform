import { ArrowRight, CircleCheck, Megaphone } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { DecisionUpdate } from '../api/types'
import { formatRelativeDay } from '../format'
import { organizerPath } from '../navigation'

const VISIBLE = 3

export function RecentDecisions({ items, now }: { items: DecisionUpdate[]; now: Date }) {
  return (
    <section className="org-card org-decisions" aria-labelledby="org-decisions-title">
      <header className="org-card__head">
        <Megaphone className="org-card__icon" size={30} aria-hidden="true" />
        <h2 id="org-decisions-title" className="org-card__title">
          Recent Decisions &amp; Updates
        </h2>
        <Link className="org-card__link" to={organizerPath('reports')}>
          View All <ArrowRight size={20} aria-hidden="true" />
        </Link>
      </header>
      {items.length === 0 ? (
        <p className="org-empty">No decisions recorded yet.</p>
      ) : (
        <ul className="org-decisions__list">
          {items.slice(0, VISIBLE).map((item) => (
            <li key={item.id}>
              <CircleCheck className="org-decisions__icon" size={22} aria-hidden="true" />
              <span className="org-decisions__text">
                {item.summary} – {item.subject}
              </span>
              <time className="org-decisions__time" dateTime={item.decidedAt}>
                {formatRelativeDay(item.decidedAt, now)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
