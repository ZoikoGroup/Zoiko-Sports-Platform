import { CalendarDays, CirclePlus } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { HeroBall, HeroBalls } from '../components/SportArt'
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

/** The Overview's two calls to action. */
export function OverviewHeroActions() {
  return (
    <>
      <Link className="org-btn org-btn--primary" to={`${organizerPath('competitions')}?new=event`}>
        <CirclePlus size={24} strokeWidth={2.2} aria-hidden="true" />
        Create Event
      </Link>
      <Link className="org-btn org-btn--ghost" to={organizerPath('fixtures')}>
        <CalendarDays size={22} aria-hidden="true" />
        View Calendar
      </Link>
    </>
  )
}

interface HeroBannerProps {
  title: string
  subtitle: string
  /** Small section label above the title. */
  eyebrow?: string
  /** "athletes" (default), or a stadium: on its own, with a cluster of balls or with a single ball. */
  art?: 'athletes' | 'stadium' | 'balls' | 'ball'
  /** Call-to-action buttons. */
  children?: ReactNode
}

/** Page banner shared by Organizer pages: title, subtitle, optional actions and artwork. */
export function HeroBanner({ title, subtitle, eyebrow, art = 'athletes', children }: HeroBannerProps) {
  const classes = ['org-hero', !children && 'org-hero--plain', art !== 'athletes' && 'org-hero--balls'].filter(Boolean).join(' ')
  return (
    <section className={classes} aria-labelledby="org-hero-title">
      <div className="org-hero__photo" aria-hidden="true" />
      {art === 'balls' && <HeroBalls className="org-hero__balls" />}
      {art === 'ball' && <HeroBall className="org-hero__balls org-hero__balls--single" />}
      <HeroSwoosh />
      <div className="org-hero__content">
        {eyebrow && <p className="org-hero__eyebrow">{eyebrow}</p>}
        <h1 id="org-hero-title" className="org-hero__title">
          {title}
        </h1>
        <p className="org-hero__subtitle">{subtitle}</p>
        {children && <div className="org-hero__actions">{children}</div>}
      </div>
    </section>
  )
}
