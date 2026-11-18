import { ChevronDown, ChevronLeft, ChevronRight, Layers, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { Competition, CompetitionStatus, RegionId, SportId } from '../api/types'
import { Flag } from '../components/Flag'
import { countryName } from '../countries'
import { SportThumb } from '../components/SportArt'
import { formatEventRange, REGION_LABELS, SPORT_LABELS } from '../format'
import { COMPETITION_STATUS_LABELS, LIFECYCLE } from './shared'

const PAGE_SIZE = 4

function FilterSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <span className="org-field-select">
      <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown size={18} aria-hidden="true" />
    </span>
  )
}

interface DirectoryProps {
  competitions: Competition[]
  region: RegionId | 'all'
  onRegionChange: (region: RegionId | 'all') => void
  onOpen: (competition: Competition, opener: HTMLElement) => void
}

export function CompetitionDirectory({ competitions, region, onRegionChange, onOpen }: DirectoryProps) {
  const [query, setQuery] = useState('')
  const [sport, setSport] = useState<SportId | 'all'>('all')
  const [status, setStatus] = useState<CompetitionStatus | 'all'>('all')
  const [page, setPage] = useState(0)

  const sports = useMemo(() => [...new Set(competitions.map((c) => c.sport))], [competitions])

  const matching = useMemo(() => {
    const q = query.trim().toLowerCase()
    return competitions
      .filter((c) => sport === 'all' || c.sport === sport)
      .filter((c) => region === 'all' || c.region === region)
      .filter((c) => status === 'all' || c.status === status)
      .filter((c) => !q || [c.name, c.city, countryName(c.country), SPORT_LABELS[c.sport]].some((v) => v.toLowerCase().includes(q)))
  }, [competitions, query, sport, region, status])

  const pages = Math.max(1, Math.ceil(matching.length / PAGE_SIZE))
  const current = Math.min(page, pages - 1)
  const rows = matching.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE)
  // Any filter change starts again from the first page.
  const filtered = <T,>(set: (v: T) => void) => (value: T) => {
    set(value)
    setPage(0)
  }
  const anyFilter = Boolean(query.trim()) || sport !== 'all' || status !== 'all' || region !== 'all'

  return (
    <section className="org-card org-directory" aria-labelledby="cmp-directory-title">
      <header className="org-card__head">
        <Layers className="org-card__icon" size={28} aria-hidden="true" />
        <h2 id="cmp-directory-title" className="org-card__title">
          Competition Directory
        </h2>
        {matching.length > PAGE_SIZE && (
          <nav className="org-pager" aria-label="Competition pages">
            <span aria-live="polite">
              {current * PAGE_SIZE + 1}–{Math.min(matching.length, (current + 1) * PAGE_SIZE)} of {matching.length}
            </span>
            <button type="button" className="org-icon-button org-icon-button--sm" aria-label="Previous page" disabled={current === 0} onClick={() => setPage(current - 1)}>
              <ChevronLeft size={20} aria-hidden="true" />
            </button>
            <button type="button" className="org-icon-button org-icon-button--sm" aria-label="Next page" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
              <ChevronRight size={20} aria-hidden="true" />
            </button>
          </nav>
        )}
      </header>

      <div className="org-directory__filters" role="search" aria-label="Filter competitions">
        <label className="org-field-search">
          <Search size={20} aria-hidden="true" />
          <span className="visually-hidden">Search competitions</span>
          <input type="search" placeholder="Search competitions..." value={query} onChange={(event) => filtered(setQuery)(event.target.value)} />
        </label>
        <FilterSelect
          label="Sport"
          value={sport}
          onChange={filtered(setSport)}
          options={[{ value: 'all', label: 'All Sports' }, ...sports.map((s) => ({ value: s, label: SPORT_LABELS[s] }))]}
        />
        <FilterSelect
          label="Region"
          value={region}
          onChange={filtered(onRegionChange)}
          options={[
            { value: 'all', label: 'All Regions' },
            ...(Object.keys(REGION_LABELS) as RegionId[]).map((r) => ({ value: r, label: REGION_LABELS[r] })),
          ]}
        />
        <FilterSelect
          label="Status"
          value={status}
          onChange={filtered(setStatus)}
          options={[{ value: 'all', label: 'All Status' }, ...LIFECYCLE.map((s) => ({ value: s, label: COMPETITION_STATUS_LABELS[s] }))]}
        />
      </div>

      {rows.length === 0 ? (
        <div className="org-empty">
          <p>No competitions match these filters.</p>
          {anyFilter && (
            <button
              type="button"
              className="org-btn org-btn--secondary"
              onClick={() => {
                setQuery('')
                setSport('all')
                setStatus('all')
                onRegionChange('all')
                setPage(0)
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="org-directory__scroll">
          <table className="org-table">
            <caption className="visually-hidden">Competitions</caption>
            <thead>
              <tr>
                <th scope="col">Sport</th>
                <th scope="col">Competition</th>
                <th scope="col">Region / Country</th>
                <th scope="col">Event Dates</th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="visually-hidden">Details</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} data-testid="competition-row">
                  <td className="org-table__sport">
                    <SportThumb sport={c.sport} className="org-table__thumb" />
                    <span>{SPORT_LABELS[c.sport]}</span>
                  </td>
                  <th scope="row" className="org-table__name">
                    <button type="button" className="org-table__link" onClick={(event) => onOpen(c, event.currentTarget)}>
                      {c.name}
                    </button>
                  </th>
                  <td>
                    <span className="org-table__country">
                      <Flag code={c.country} />
                      {countryName(c.country)}
                    </span>
                  </td>
                  <td className="org-table__dates">
                    <time dateTime={c.startsAt}>{formatEventRange(c.startsAt, c.endsAt, c.timeZone)}</time>
                  </td>
                  <td>
                    <span className={`org-status org-status--${c.status}`}>{COMPETITION_STATUS_LABELS[c.status]}</span>
                  </td>
                  <td className="org-table__go">
                    <button
                      type="button"
                      className="org-icon-button org-icon-button--sm"
                      aria-label={`View details for ${c.name}`}
                      onClick={(event) => onOpen(c, event.currentTarget)}
                    >
                      <ChevronRight size={22} aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

    </section>
  )
}
