import { ArrowRight, ClipboardList, SquareCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { ApprovalTask } from '../api/types'
import { organizerPath } from '../navigation'

export function TasksApprovals({ totalPending, items }: { totalPending: number; items: ApprovalTask[] }) {
  return (
    <section className="org-card org-tasks" aria-labelledby="org-tasks-title">
      <header className="org-card__head">
        <ClipboardList className="org-card__icon" size={26} aria-hidden="true" />
        <h2 id="org-tasks-title" className="org-card__title">
          Tasks &amp; Approvals
          <span className="org-count" aria-label={`${totalPending} pending`}>
            {totalPending}
          </span>
        </h2>
        <Link className="org-card__link" to={organizerPath('action-center')}>
          View All <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </header>
      {items.length === 0 ? (
        <p className="org-empty">Nothing waiting for you.</p>
      ) : (
        <ul className="org-list">
          {items.slice(0, 3).map((task) => (
            <li key={task.id}>
              <Link className="org-list__row org-tasks__row" to={organizerPath(task.module)}>
                <SquareCheck className="org-tasks__icon" size={21} aria-hidden="true" />
                <span className="org-list__text">{task.label}</span>
                <span className="org-pill">{task.pending} pending</span>
                <ArrowRight className="org-tasks__go" size={20} aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
