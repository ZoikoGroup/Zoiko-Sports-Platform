import { CalendarDays, CirclePlus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { organizerPath } from '../navigation'

/** Brand ribbons along the banner's lower edge. */
function HeroSwoosh() {
  return (
    <svg className="org-hero__swoosh" viewBox="0 0 1000 60" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="org-hero-gold" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffd60a" stopOpacity="0" />
          <stop offset="0.35" stopColor="#ffd60a" />
          <stop offset="1" stopColor="#f5b800" />
        </linearGradient>
      </defs>
      <path d="M260 60C520 34 760 22 1000 6v16C780 34 560 48 430 60Z" fill="url(#org-hero-gold)" />
      <path d="M520 60C700 44 860 36 1000 30v30Z" fill="#2c6cff" opacity="0.9" />
    </svg>
  )
}

export function HeroBanner({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <section className="org-hero" aria-labelledby="org-hero-title">
      <div className="org-hero__photo" aria-hidden="true" />
      <HeroSwoosh />
      <div className="org-hero__content">
        <h1 id="org-hero-title" className="org-hero__title">
          {title}
        </h1>
        <p className="org-hero__subtitle">{subtitle}</p>
        <div className="org-hero__actions">
          <Link className="org-btn org-btn--primary" to={`${organizerPath('competitions')}?new=event`}>
            <CirclePlus size={24} strokeWidth={2.2} aria-hidden="true" />
            Create Event
          </Link>
          <Link className="org-btn org-btn--ghost" to={organizerPath('fixtures')}>
            <CalendarDays size={22} aria-hidden="true" />
            View Calendar
          </Link>
        </div>
      </div>
    </section>
  )
}
