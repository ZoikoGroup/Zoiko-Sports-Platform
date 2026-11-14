import { CalendarDays, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { HeroBalls } from '../components/SportArt'
import { organizerPath } from '../navigation'

export function HeroBanner({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <section className="org-hero" aria-labelledby="org-hero-title">
      <div className="org-hero__photo" aria-hidden="true" />
      <HeroBalls className="org-hero__balls" />
      <div className="org-hero__content">
        <h1 id="org-hero-title" className="org-hero__title">
          {title}
        </h1>
        <p className="org-hero__subtitle">{subtitle}</p>
        <div className="org-hero__actions">
          <Link className="org-btn org-btn--primary" to={`${organizerPath('competitions')}?new=event`}>
            <Plus size={24} strokeWidth={2.4} aria-hidden="true" />
            Create Event
          </Link>
          <Link className="org-btn org-btn--ghost" to={organizerPath('fixtures')}>
            <CalendarDays size={22} aria-hidden="true" />
            View Global Calendar
          </Link>
        </div>
      </div>
    </section>
  )
}
