import { ArrowRight, Globe } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { RegionId, RegionShare } from '../api/types'
import { REGION_PINS, WORLD_LAND_PATH, WORLD_VIEWBOX } from '../components/worldMap'
import { REGION_LABELS } from '../format'
import { organizerPath } from '../navigation'

const PIN_KEY: Record<RegionId, keyof typeof REGION_PINS> = {
  'north-america': 'northAmerica',
  'south-america': 'southAmerica',
  europe: 'europe',
  africa: 'africa',
  asia: 'asia',
  oceania: 'oceania',
}

export function GlobalParticipation({ shares, region }: { shares: RegionShare[]; region: RegionId | 'all' }) {
  const summary = shares.map((s) => `${REGION_LABELS[s.region]} ${s.percent}%`).join(', ')
  return (
    <section className="org-card org-participation" aria-labelledby="org-participation-title">
      <header className="org-card__head">
        <Globe className="org-card__icon" size={30} aria-hidden="true" />
        <h2 id="org-participation-title" className="org-card__title">
          Global Participation
        </h2>
        <Link className="org-card__link" to={organizerPath('participants')}>
          View Details <ArrowRight size={20} aria-hidden="true" />
        </Link>
      </header>
      <div className="org-participation__body">
        <svg
          className="org-map"
          viewBox={`0 0 ${WORLD_VIEWBOX.width} ${WORLD_VIEWBOX.height}`}
          role="img"
          aria-label={`Share of participating organizations by region: ${summary}`}
        >
          <defs>
            <linearGradient id="org-map-fill" x1="0" y1="0" x2="0.35" y2="1">
              <stop offset="0" className="org-map__stop-a" />
              <stop offset="0.55" className="org-map__stop-b" />
              <stop offset="1" className="org-map__stop-c" />
            </linearGradient>
          </defs>
          <path d={WORLD_LAND_PATH} fill="url(#org-map-fill)" className="org-map__land" />
          {shares.map((share) => {
            const [x, y] = REGION_PINS[PIN_KEY[share.region]]
            const dim = region !== 'all' && region !== share.region
            return (
              <g key={share.region} transform={`translate(${x} ${y})`} className={`org-map__pin${dim ? ' is-dim' : ''}`}>
                <path d="M0 0C-2.5-6-10-9.5-10-17a10 10 0 0 1 20 0c0 7.5-7.5 11-10 17Z" />
                <circle cy="-17" r="4" />
              </g>
            )
          })}
        </svg>
        <ul className="org-legend" aria-label="Participation by region">
          {shares.map((share) => (
            <li key={share.region} className={region !== 'all' && region !== share.region ? 'is-dim' : undefined}>
              <span className={`org-legend__dot org-legend__dot--${share.region}`} aria-hidden="true" />
              <span className="org-legend__name">{REGION_LABELS[share.region]}</span>
              <span className="org-legend__value">{share.percent}%</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
