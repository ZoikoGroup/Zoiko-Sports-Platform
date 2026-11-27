import { ArrowRight, CircleAlert, CircleCheck, Clock, Send, TriangleAlert, X } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { describeError } from '../../../api/resource'
import { StadiumIcon } from '../../../components/icons'
import type { ReadinessCheck, VenueReadiness } from '../api/types'
import { Dialog } from '../components/Dialog'
import { formatLocalDateTime, REGION_LABELS } from '../format'
import { organizerPath } from '../navigation'
import { placeLabel, READINESS_LABELS } from './readiness'

const CHECK_ICONS: Record<ReadinessCheck['state'], typeof CircleCheck> = {
  complete: CircleCheck,
  pending: Clock,
  attention: TriangleAlert,
}

interface VenueDrawerProps {
  venue: VenueReadiness | null
  /** Put the cursor in the request-an-update message (opened from "Request an update"). */
  focusRequest?: boolean
  /** The active role may ask the venue for an update; otherwise the form is not shown. */
  canRequest?: boolean
  onClose: () => void
  /** Sends the request to the server; resolves when it is accepted. */
  onRequestUpdate: (venue: VenueReadiness, message: string) => Promise<void>
}

/** Side panel with one venue's readiness for one event: facts, checklist and a request for an update. */
export function VenueDrawer({ venue, focusRequest = false, canRequest = false, onClose, onRequestUpdate }: VenueDrawerProps) {
  const v = venue
  return (
    <Dialog open={Boolean(v)} onClose={onClose} labelledBy="vr-drawer-title" variant="drawer">
      {v && <VenueDetails key={v.id} venue={v} focusRequest={focusRequest} canRequest={canRequest} onClose={onClose} onRequestUpdate={onRequestUpdate} />}
    </Dialog>
  )
}

function VenueDetails({ venue: v, focusRequest, canRequest, onClose, onRequestUpdate }: { venue: VenueReadiness } & Omit<VenueDrawerProps, 'venue'>) {
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const id = useId()
  const { date, time } = formatLocalDateTime(v.startsAt, v.timeZone)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const text = message.trim()
    if (!text) {
      setError('Say what the venue should update.')
      return
    }
    setSending(true)
    setError(null)
    try {
      await onRequestUpdate(v, text)
      setSent(true)
      setMessage('')
    } catch (failure) {
      setError(describeError(failure, "We couldn't send this request. Please try again."))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="org-drawer" data-testid="venue-drawer">
      <header className="org-drawer__head">
        <span className={`org-vr-tile org-vr-tile--${v.status}`} aria-hidden="true">
          <StadiumIcon size={26} />
        </span>
        <div className="org-drawer__heading">
          <h2 id="vr-drawer-title">{v.venue}</h2>
          <span className={`org-status org-status--vr-${v.status}`}>{READINESS_LABELS[v.status]}</span>
        </div>
        <button type="button" className="org-icon-button" onClick={onClose} aria-label="Close details">
          <X size={22} aria-hidden="true" />
        </button>
      </header>

      {v.issue && (
        <p className="org-info org-info--attention" role="note">
          <TriangleAlert size={20} aria-hidden="true" />
          {v.issue}
        </p>
      )}

      <dl className="org-facts">
        <div>
          <dt>Event</dt>
          <dd>{v.event}</dd>
        </div>
        <div>
          <dt>Competition</dt>
          <dd>{v.competition}</dd>
        </div>
        <div>
          <dt>Location</dt>
          <dd>
            {placeLabel(v)} · {REGION_LABELS[v.region]}
          </dd>
        </div>
        <div>
          <dt>Local time</dt>
          <dd>
            {date}, {time}
          </dd>
        </div>
        <div>
          <dt>Evidence</dt>
          <dd>{v.evidenceItems === 1 ? '1 item' : `${v.evidenceItems} items`}</dd>
        </div>
        <div>
          <dt>Checks complete</dt>
          <dd>{v.checks ? `${v.checks.complete} of ${v.checks.total}` : 'No checklist yet'}</dd>
        </div>
      </dl>

      <section aria-labelledby="vr-drawer-checks">
        <h3 id="vr-drawer-checks" className="org-drawer__section">
          Readiness checks {v.checkList && <span>({v.checkList.length})</span>}
        </h3>
        {!v.checkList || v.checkList.length === 0 ? (
          <p className="org-drawer__empty">The venue hasn't shared its checklist for this event yet.</p>
        ) : (
          <ul className="org-drawer__list org-vr-checks" data-testid="venue-checks">
            {v.checkList.map((check) => {
              const Icon = CHECK_ICONS[check.state]
              return (
                <li key={check.id}>
                  <Icon className={`org-vr-checks__icon org-vr-checks__icon--${check.state}`} size={20} aria-hidden="true" />
                  <span className="org-drawer__item">
                    <strong>{check.title}</strong>
                  </span>
                  <span className={`org-status org-status--check-${check.state}`}>{check.label}</span>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {canRequest && (
        <form className="org-vr-request" onSubmit={submit} noValidate>
          <h3 className="org-drawer__section">Request an update</h3>
          <div className={`org-form__field org-form__field--wide${error && !message.trim() ? ' is-invalid' : ''}`}>
            <label htmlFor={`${id}-message`}>Message to {v.venue}</label>
            <textarea
              id={`${id}-message`}
              data-autofocus={focusRequest ? '' : undefined}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="e.g. Please upload the signed safety inspection certificate."
              aria-invalid={error !== null && !message.trim()}
            />
          </div>
          {error && (
            <p className="org-form__error" role="alert">
              <CircleAlert size={18} aria-hidden="true" /> {error}
            </p>
          )}
          {sent && (
            <p className="org-vr-request__sent" role="status">
              <CircleCheck size={18} aria-hidden="true" /> Request sent. It appears in the venue's activity feed.
            </p>
          )}
          <footer className="org-drawer__actions">
            <button type="submit" className="org-btn org-btn--secondary" disabled={sending}>
              <Send size={18} aria-hidden="true" /> {sending ? 'Sending…' : 'Send request'}
            </button>
          </footer>
        </form>
      )}

      <footer className="org-drawer__actions org-vr-drawer__links">
        <Link className="org-btn org-btn--secondary" to={`${organizerPath('fixtures')}?competition=${v.competitionId}`}>
          Fixtures &amp; Schedule <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </footer>
    </div>
  )
}
