import { ChartNoAxesColumnIncreasing, ChevronDown, Globe, Trophy, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import ambient from '../assets/backgrounds/stadium-ambient.jpg'
import plateHalfJpg from '../assets/backgrounds/stadium-wide-1360.jpg'
import plateHalfWebp from '../assets/backgrounds/stadium-wide-1360.webp'
import plateJpg from '../assets/backgrounds/stadium-wide.jpg'
import plateWebp from '../assets/backgrounds/stadium-wide.webp'
import { FOOTER_LINKS } from '../config/siteLinks'
import { StadiumIcon } from './icons'
import { Logo } from './Logo'
import { ThemeToggle } from './ThemeToggle'
import './AuthLayout.css'

const FEATURES = [
  { label: 'Competitions', icon: Trophy },
  { label: 'Venues', icon: StadiumIcon },
  { label: 'Teams & Clubs', icon: Users },
  { label: 'Analytics & Insights', icon: ChartNoAxesColumnIncreasing },
]

// Must match the desktop breakpoint in AuthLayout.css. Below it the plate is not
// drawn (the in-flow stage frames the athletes), so a 1×1 GIF stands in and the
// full-size artwork is never downloaded on phones.
const DESKTOP = '(min-width: 1200px)'
// The plate is drawn 2720 reference px wide, i.e. 1.7× the 1600px artboard.
const PLATE_SIZES = '170vw'
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

/** Stadium artwork; its centre 1600×900 reproduces the reference framing exactly. */
function StadiumPlate() {
  return (
    <picture>
      <source media={DESKTOP} type="image/webp" srcSet={`${plateHalfWebp} 1360w, ${plateWebp} 2720w`} sizes={PLATE_SIZES} />
      <source media={DESKTOP} srcSet={`${plateHalfJpg} 1360w, ${plateJpg} 2720w`} sizes={PLATE_SIZES} />
      <img className="auth-plate" src={BLANK} width={2720} height={1454} alt="" aria-hidden="true" fetchPriority="high" />
    </picture>
  )
}

/** Brand ribbons sweeping across the bottom-right corner, as in the reference. */
function Swoosh() {
  return (
    <svg className="auth-swoosh" viewBox="0 0 640 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="swoosh-deep" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#1f55f0" />
          <stop offset="1" stopColor="#3a1aa8" />
        </linearGradient>
        <linearGradient id="swoosh-gold" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#f5b800" />
          <stop offset="0.6" stopColor="#ffd60a" />
          <stop offset="1" stopColor="#ffe14d" />
        </linearGradient>
      </defs>
      <path d="M0 100 C 90 68 210 56 320 58 C 250 64 140 80 70 100 Z" fill="#2c6cff" opacity="0.9" />
      <path d="M150 100 C 320 64 470 44 640 30 L 640 100 Z" fill="url(#swoosh-deep)" />
      <path d="M150 100 C 320 58 470 32 640 13 L 640 32 C 480 46 340 72 250 100 Z" fill="url(#swoosh-gold)" />
    </svg>
  )
}

function LanguageSelect() {
  // Only US English is available; the control reflects that rather than offering
  // languages that don't exist yet.
  return (
    <div className="lang-select">
      <Globe aria-hidden="true" />
      <label htmlFor="language" className="visually-hidden">
        Language
      </label>
      <select id="language" defaultValue="en-US">
        <option value="en-US">English (US)</option>
      </select>
      <ChevronDown aria-hidden="true" />
    </div>
  )
}

function AuthFooter() {
  return (
    <footer className="auth-footer">
      <ul className="auth-footer__links">
        {FOOTER_LINKS.map(({ label, href }) => (
          <li key={label}>{href ? <a href={href}>{label}</a> : <span>{label}</span>}</li>
        ))}
      </ul>
      <p className="auth-footer__note">Supported through Zoiko Tech Inc.</p>
    </footer>
  )
}

/**
 * Page frame for every sign-in screen.
 *
 * Desktop (≥1200px): a 1600×900 "artboard" reproducing the reference design.
 * Every dimension is expressed in reference pixels (--u), so the whole
 * composition scales as one and keeps its exact proportions at any resolution.
 * On screens wider than 16:9 the artboard stretches to the full width: the brand
 * column and card keep their reference edge margins and the stadium stays centred.
 * Tablet / mobile: the same elements stacked in a single column.
 */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-shell">
      <div className="auth-ambient" aria-hidden="true">
        <img src={ambient} alt="" />
      </div>

      <div className="auth-board">
        <StadiumPlate />

        <header className="auth-lang">
          <ThemeToggle />
          <LanguageSelect />
        </header>

        <div className="auth-brand">
          <section className="auth-intro" aria-label="About Zoiko Sports">
            <Logo variant="lockup" className="auth-intro__logo" />
            <p className="auth-intro__headline">
              <span>Powering the </span>
              <span>Next Generation </span>
              <span className="auth-intro__accent">of Sport.</span>
            </p>
            <p className="auth-intro__lede">
              Plan, operate and grow competitions, venues, teams and fan experiences — globally.
            </p>
          </section>

          <ul className="auth-features" aria-label="Platform areas">
            {FEATURES.map(({ label, icon: Icon }) => (
              <li key={label}>
                <Icon aria-hidden="true" />
                <span>{label}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="auth-stage" aria-hidden="true" />

        <main className="auth-card-column">
          <div className="auth-card">{children}</div>
          <AuthFooter />
        </main>
      </div>

      <Swoosh />
    </div>
  )
}
