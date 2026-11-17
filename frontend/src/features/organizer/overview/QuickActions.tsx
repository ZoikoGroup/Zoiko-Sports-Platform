import { CalendarPlus, ChartNoAxesColumnIncreasing, UserPlus, Zap, type LucideIcon } from 'lucide-react'
import type { ComponentType } from 'react'
import { Link } from 'react-router-dom'
import { StadiumIcon } from '../../../components/icons'
import { organizerPath } from '../navigation'

interface QuickAction {
  label: string
  to: string
  icon: LucideIcon | ComponentType<{ size?: number; strokeWidth?: number }>
  tone: 'violet' | 'blue'
}

const ACTIONS: QuickAction[] = [
  { label: 'Create Competition', to: `${organizerPath('competitions')}?new=competition`, icon: CalendarPlus, tone: 'violet' },
  { label: 'Add Organization', to: `${organizerPath('participants')}?new=organization`, icon: UserPlus, tone: 'blue' },
  { label: 'Manage Venues', to: organizerPath('venues'), icon: StadiumIcon, tone: 'violet' },
  { label: 'View Reports', to: organizerPath('reports'), icon: ChartNoAxesColumnIncreasing, tone: 'blue' },
]

export function QuickActions() {
  return (
    <section className="org-card org-quick" aria-labelledby="org-quick-title">
      <header className="org-card__head">
        <Zap className="org-card__icon" size={26} aria-hidden="true" />
        <h2 id="org-quick-title" className="org-card__title">
          Quick Actions
        </h2>
      </header>
      <ul className="org-quick__list">
        {ACTIONS.map(({ label, to, icon: Icon, tone }) => (
          <li key={label}>
            <Link className={`org-quick__action org-quick__action--${tone}`} to={to}>
              <Icon size={34} strokeWidth={1.8} aria-hidden="true" />
              <span>{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
