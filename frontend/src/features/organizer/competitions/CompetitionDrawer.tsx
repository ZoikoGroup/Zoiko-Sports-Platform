import { ArrowRight, Check, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Competition } from '../api/types'
import { Dialog } from '../components/Dialog'
import { Flag } from '../components/Flag'
import { countryName } from '../countries'
import { SportThumb } from '../components/SportArt'
import { formatAgo, formatEventRange, SPORT_LABELS } from '../format'
import { organizerPath } from '../navigation'
import { COMPETITION_STATUS_LABELS, EVENT_STATUS_LABELS, LIFECYCLE } from './shared'

const eventDate = (iso: string, timeZone: string) =>
  new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(iso))

/** Side panel with a competition's lifecycle, facts, events and history. */
export function CompetitionDrawer({ competition, onClose, now }: { competition: Competition | null; onClose: () => void; now: Date }) {
  const c = competition
  const stage = c ? LIFECYCLE.indexOf(c.status) : -1
  return (
    <Dialog open={Boolean(c)} onClose={onClose} labelledBy="cmp-drawer-title" variant="drawer">
      {c && (
        <div className="org-drawer" data-testid="competition-drawer">
          <header className="org-drawer__head">
            <SportThumb sport={c.sport} className="org-drawer__thumb" />
            <div className="org-drawer__heading">
              <h2 id="cmp-drawer-title">{c.name}</h2>
              <span className={`org-status org-status--${c.status}`}>{COMPETITION_STATUS_LABELS[c.status]}</span>
            </div>
            <button type="button" className="org-icon-button" onClick={onClose} aria-label="Close details">
              <X size={22} aria-hidden="true" />
            </button>
          </header>

          <ol className="org-stepper" aria-label="Lifecycle">
            {LIFECYCLE.map((step, i) => (
              <li key={step} className={i < stage ? 'is-done' : i === stage ? 'is-current' : undefined} aria-current={i === stage ? 'step' : undefined}>
                <span className="org-stepper__dot" aria-hidden="true">
                  {i < stage ? <Check size={14} strokeWidth={3} /> : i + 1}
                </span>
                <span>{COMPETITION_STATUS_LABELS[step]}</span>
              </li>
            ))}
          </ol>

          <dl className="org-facts">
            <div>
              <dt>Sport</dt>
              <dd>{SPORT_LABELS[c.sport]}</dd>
            </div>
            <div>
              <dt>Location</dt>
              <dd className="org-facts__country">
                <Flag code={c.country} />
                {c.city}, {countryName(c.country)}
              </dd>
            </div>
            <div>
              <dt>Dates</dt>
              <dd>{formatEventRange(c.startsAt, c.endsAt, c.timeZone)}</dd>
            </div>
            <div>
              <dt>Organizations</dt>
              <dd>{c.organizations}</dd>
            </div>
          </dl>

          <section aria-labelledby="cmp-drawer-events">
            <h3 id="cmp-drawer-events" className="org-drawer__section">
              Events <span>({c.events.length})</span>
            </h3>
            {c.events.length === 0 ? (
              <p className="org-drawer__empty">No events yet. Use Create Event to add the first one.</p>
            ) : (
              <ul className="org-drawer__list" data-testid="drawer-events">
                {c.events.map((e) => (
                  <li key={e.id}>
                    <span className="org-drawer__item">
                      <strong>{e.name}</strong>
                      <span>
                        {eventDate(e.startsAt, c.timeZone)} · {e.venue}
                      </span>
                    </span>
                    <span className={`org-status org-status--${e.status}`}>{EVENT_STATUS_LABELS[e.status]}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="cmp-drawer-history">
            <h3 id="cmp-drawer-history" className="org-drawer__section">
              History
            </h3>
            <ul className="org-drawer__list org-drawer__list--history">
              {c.history.map((h) => (
                <li key={h.id}>
                  <span className="org-drawer__item">
                    <strong>{h.summary}</strong>
                    <span>{h.actor}</span>
                  </span>
                  <time dateTime={h.at}>{formatAgo(h.at, now)}</time>
                </li>
              ))}
            </ul>
          </section>

          <footer className="org-drawer__actions">
            <Link className="org-btn org-btn--secondary" to={`${organizerPath('fixtures')}?competition=${c.id}`}>
              Fixtures &amp; Schedule <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link className="org-btn org-btn--secondary" to={`${organizerPath('venues')}?competition=${c.id}`}>
              Venue Readiness <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link className="org-btn org-btn--secondary" to={`${organizerPath('participants')}?competition=${c.id}`}>
              Participants <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </footer>
        </div>
      )}
    </Dialog>
  )
}
