import { Globe, UsersRound } from 'lucide-react'
import type { Participation, RegionId } from '../api/types'
import { REGION_PINS, WORLD_DOTS_PATH, WORLD_DOT_STEP, WORLD_VIEWBOX } from '../components/worldMap'
import { Metric } from '../components/DataState'
import { REGION_LABELS } from '../format'

const PIN_KEY: Record<RegionId, keyof typeof REGION_PINS> = {
  'north-america': 'northAmerica',
  'south-america': 'southAmerica',
  europe: 'europe',
  africa: 'africa',
  asia: 'asia',
  oceania: 'oceania',
}

export function GlobalParticipation({ participation, region }: { participation: Participation | null; region: RegionId | 'all' }) {
  const marked = participation?.regions ?? []
  const label = marked.length
    ? `World map marking regions with participants: ${marked.map((r) => REGION_LABELS[r]).join(', ')}`
    : 'World map; no participating regions to mark'
  return (
    <section className="org-card org-participation" aria-labelledby="org-participation-title">
      <header className="org-card__head">
        <Globe className="org-card__icon" size={26} aria-hidden="true" />
        <h2 id="org-participation-title" className="org-card__title">
          Global Participation
        </h2>
      </header>
      <svg
        className="org-map"
        viewBox={`0 0 ${WORLD_VIEWBOX.width} ${WORLD_VIEWBOX.height}`}
        role="img"
        aria-label={label}
      >
        <path d={WORLD_DOTS_PATH} className="org-map__dots" strokeWidth={WORLD_DOT_STEP * 0.62} />
        {marked.map((r) => {
          const [x, y] = REGION_PINS[PIN_KEY[r]]
          const dim = region !== 'all' && region !== r
          return (
            <g key={r} transform={`translate(${x} ${y})`} className={`org-map__pin${dim ? ' is-dim' : ''}`}>
              <title>{REGION_LABELS[r]}</title>
              <path d="M0 0C-3-7-13-12-13-22a13 13 0 0 1 26 0c0 10-10 15-13 22Z" />
              <circle cy="-22" r="5" />
            </g>
          )
        })}
      </svg>
      <dl className="org-participation__stats">
        <div>
          <UsersRound size={26} aria-hidden="true" />
          <dt className="visually-hidden">Registered teams</dt>
          <dd>
            <strong>
              <Metric value={participation?.registeredTeams} />
            </strong>
            <span aria-hidden="true">Registered Teams</span>
          </dd>
        </div>
        <div>
          <Globe size={26} aria-hidden="true" />
          <dt className="visually-hidden">Countries and regions</dt>
          <dd>
            <strong>
              <Metric value={participation?.countries} />
            </strong>
            <span aria-hidden="true">Countries / Regions</span>
          </dd>
        </div>
      </dl>
    </section>
  )
}
