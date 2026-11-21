import { ArrowRight, CircleAlert, History, Send, TriangleAlert, Users, X } from 'lucide-react'
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import type { Fixture, FixtureChangeInput, PublishInput } from '../api/types'
import { Dialog } from '../components/Dialog'
import { Flag } from '../components/Flag'
import { SportThumb } from '../components/SportArt'
import { countryName } from '../countries'
import { formatAgo, formatLocalDateTime, localDay, zonedTimeToUtc } from '../format'
import { allows, current, FIXTURE_STATUS_LABELS, fixtureStatus, publishedVersion } from './schedule'

const viewerTime = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })

const both = (iso: string, timeZone: string) => {
  const { date, time } = formatLocalDateTime(iso, timeZone)
  return `${date}, ${time}`
}

/** An action sent to the server: resolves with null when accepted, or the reason it was not. */
type Outcome = Promise<string | null>

interface FixtureDrawerProps {
  fixture: Fixture | null
  now: Date
  onClose: () => void
  onPropose: (fixture: Fixture, input: FixtureChangeInput) => Outcome
  onRequestApproval: (fixture: Fixture) => Outcome
  onPublish: (fixture: Fixture, input: PublishInput) => Outcome
  onDiscard: (fixture: Fixture) => Outcome
}

function ProposeForm({ fixture, onSubmit, onCancel }: { fixture: Fixture; onSubmit: (input: FixtureChangeInput) => Outcome; onCancel: () => void }) {
  const id = useId()
  const now = current(fixture)
  const [date, setDate] = useState(localDay(now.startsAt, fixture.timeZone))
  const [time, setTime] = useState(() => new Intl.DateTimeFormat('en-GB', { timeZone: fixture.timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(now.startsAt)))
  const [venue, setVenue] = useState(now.venue)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const reasonRef = useRef<HTMLTextAreaElement>(null)

  // The form opens inside the panel: start where the user must type.
  useEffect(() => reasonRef.current?.focus(), [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!date || !time) return setError('Choose a date and time.')
    if (!venue.trim()) return setError('Enter the venue.')
    if (!reason.trim()) return setError('Give a reason for the change.')
    const [y, m, d] = date.split('-').map(Number)
    const [h, min] = time.split(':').map(Number)
    const startsAt = zonedTimeToUtc(y, m - 1, d, h, min, fixture.timeZone).toISOString()
    if (startsAt === now.startsAt && venue.trim() === now.venue) return setError('Change the time or the venue to propose a new version.')
    setSaving(true)
    setError((await onSubmit({ baseVersion: publishedVersion(fixture), startsAt, venue: venue.trim(), reason: reason.trim() })) ?? '')
    setSaving(false)
  }

  return (
    <form className="org-propose" onSubmit={submit} noValidate aria-labelledby={`${id}-title`} aria-busy={saving}>
      <h3 id={`${id}-title`} className="org-drawer__section">
        Propose a change
      </h3>
      <div className="org-form__grid">
        <div className="org-form__field">
          <label htmlFor={`${id}-date`}>Local date</label>
          <input id={`${id}-date`} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="org-form__field">
          <label htmlFor={`${id}-time`}>Local time ({formatLocalDateTime(now.startsAt, fixture.timeZone).time.split(' ').pop()})</label>
          <input id={`${id}-time`} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <div className="org-form__field org-form__field--wide">
          <label htmlFor={`${id}-venue`}>Venue</label>
          <input id={`${id}-venue`} value={venue} onChange={(e) => setVenue(e.target.value)} />
        </div>
        <div className="org-form__field org-form__field--wide">
          <label htmlFor={`${id}-reason`}>Reason for the change</label>
          <textarea ref={reasonRef} id={`${id}-reason`} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      </div>
      {error && (
        <p className="org-form__error" role="alert">
          {error}
        </p>
      )}
      <div className="org-form__actions">
        <button type="button" className="org-btn org-btn--secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="org-btn org-btn--primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save proposal'}
        </button>
      </div>
    </form>
  )
}

/** Side panel: published version, a proposed change and its approval, history and recipients. */
export function FixtureDrawer({ fixture, now, onClose, onPropose, onRequestApproval, onPublish, onDiscard }: FixtureDrawerProps) {
  const [proposing, setProposing] = useState(false)
  const [reason, setReason] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const f = fixture
  const close = () => {
    setProposing(false)
    setReason(null)
    setError('')
    onClose()
  }

  if (!f) return <Dialog open={false} onClose={close} labelledBy="fx-drawer-title" variant="drawer">{null}</Dialog>

  const status = fixtureStatus(f)
  const live = current(f)
  const published = f.revisions[0]
  const change = f.change
  const approver = allows(f, 'approve')
  const publishReason = reason ?? change?.reason ?? ''
  const changed = (a: string, b: string) => (a === b ? undefined : 'is-changed')

  /** Runs one server action at a time and shows why it was refused, if it was. */
  async function run(action: () => Outcome, after?: () => void) {
    setBusy(true)
    setError('')
    const refused = await action()
    setBusy(false)
    if (refused) setError(refused)
    else after?.()
  }

  return (
    <Dialog open onClose={close} labelledBy="fx-drawer-title" variant="drawer">
      <div className="org-drawer" data-testid="fixture-drawer" aria-busy={busy}>
        <header className="org-drawer__head">
          <SportThumb sport={f.sport} className="org-drawer__thumb" />
          <div className="org-drawer__heading">
            <h2 id="fx-drawer-title">
              {f.home} vs. {f.away}
            </h2>
            <span className="org-drawer__sub">{f.competition}</span>
            <span className={`org-status org-status--fx-${status}`}>{FIXTURE_STATUS_LABELS[status]}</span>
          </div>
          <button type="button" className="org-icon-button" onClick={close} aria-label="Close fixture details">
            <X size={22} aria-hidden="true" />
          </button>
        </header>

        {f.conflict && (
          <p className="org-banner org-banner--critical" role="note">
            <TriangleAlert size={20} aria-hidden="true" />
            <span>
              <strong>Schedule conflict.</strong> {f.conflict} Propose and publish a new time or venue to resolve it.
            </span>
          </p>
        )}

        <dl className="org-facts">
          <div>
            <dt>Local time</dt>
            <dd>{both(live.startsAt, f.timeZone)}</dd>
          </div>
          <div>
            <dt>Your time</dt>
            <dd>{viewerTime(live.startsAt)}</dd>
          </div>
          <div>
            <dt>Venue</dt>
            <dd className="org-facts__country">
              <Flag code={f.country} />
              {live.venue}, {f.city}, {countryName(f.country)}
            </dd>
          </div>
          <div>
            <dt>Published version</dt>
            <dd>{published ? `v${published.version} · ${published.author}, ${formatAgo(published.publishedAt, now)}` : 'Not published yet'}</dd>
          </div>
        </dl>

        {change ? (
          <section className="org-change" aria-labelledby="fx-change-title">
            <div className="org-change__head">
              <h3 id="fx-change-title" className="org-drawer__section">
                {published ? `Proposed change · v${change.version}` : `New fixture · v${change.version}`}
              </h3>
              <span className={`org-status ${change.state === 'proposed' ? 'org-status--draft' : 'org-status--preparing'}`}>
                {change.state === 'proposed' ? 'Draft' : 'Awaiting approval'}
              </span>
            </div>
            <table className="org-compare">
              <caption className="visually-hidden">Published and proposed versions</caption>
              <thead>
                <tr>
                  <th scope="col">
                    <span className="visually-hidden">Field</span>
                  </th>
                  <th scope="col">{published ? `Published v${published.version}` : 'Published'}</th>
                  <th scope="col">Proposed v{change.version}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Date &amp; time</th>
                  <td>{published ? both(published.startsAt, f.timeZone) : '—'}</td>
                  <td className={published ? changed(published.startsAt, change.startsAt) : 'is-changed'}>{both(change.startsAt, f.timeZone)}</td>
                </tr>
                <tr>
                  <th scope="row">Venue</th>
                  <td>{published?.venue ?? '—'}</td>
                  <td className={published ? changed(published.venue, change.venue) : 'is-changed'}>{change.venue}</td>
                </tr>
              </tbody>
            </table>
            <p className="org-change__meta">
              <strong>Reason:</strong> {change.reason} <span>· {change.author}, {formatAgo(change.proposedAt, now)}</span>
            </p>

            {change.state === 'awaiting-approval' && (
              <div className="org-recipients" aria-labelledby="fx-recipients-title">
                <h4 id="fx-recipients-title">
                  <Users size={18} aria-hidden="true" /> Recipient preview
                </h4>
                <p>Publishing sends the new version to:</p>
                <ul>
                  {f.recipients.map((r) => (
                    <li key={r.role}>
                      <span>{r.role}</span>
                      {r.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {change.state === 'awaiting-approval' && approver && (
              <div className="org-form__field">
                <label htmlFor="fx-publish-reason">Reason recorded with the publication</label>
                <textarea id="fx-publish-reason" rows={2} value={publishReason} onChange={(e) => setReason(e.target.value)} />
              </div>
            )}

            {error && (
              <p className="org-banner org-banner--critical" role="alert">
                <CircleAlert size={20} aria-hidden="true" />
                <span>{error}</span>
              </p>
            )}

            <div className="org-form__actions">
              {allows(f, 'discard') && (
                <button type="button" className="org-btn org-btn--secondary" disabled={busy} onClick={() => void run(() => onDiscard(f))}>
                  {published ? 'Discard change' : 'Discard fixture'}
                </button>
              )}
              {change.state === 'proposed' && allows(f, 'request-approval') && (
                <button type="button" className="org-btn org-btn--primary" disabled={busy} onClick={() => void run(() => onRequestApproval(f))}>
                  <Send size={18} aria-hidden="true" /> Request approval
                </button>
              )}
              {change.state === 'awaiting-approval' &&
                (approver ? (
                  <button
                    type="button"
                    className="org-btn org-btn--primary"
                    disabled={busy}
                    onClick={() => {
                      if (!publishReason.trim()) return setError('Give a reason for publishing this change.')
                      void run(
                        () => onPublish(f, { expectedVersion: publishedVersion(f), reason: publishReason.trim() }),
                        () => setReason(null),
                      )
                    }}
                  >
                    Approve &amp; publish v{change.version}
                  </button>
                ) : (
                  <p className="org-change__meta">Waiting for an approver with authority for this event.</p>
                ))}
            </div>
          </section>
        ) : proposing ? (
          <ProposeForm
            fixture={f}
            onCancel={() => setProposing(false)}
            onSubmit={async (input) => {
              const refused = await onPropose(f, input)
              if (!refused) setProposing(false)
              return refused
            }}
          />
        ) : (
          allows(f, 'propose') && (
            <div className="org-drawer__actions org-drawer__actions--top">
              <button type="button" className="org-btn org-btn--primary" onClick={() => setProposing(true)}>
                Propose change <ArrowRight size={18} aria-hidden="true" />
              </button>
            </div>
          )
        )}

        <section aria-labelledby="fx-history-title">
          <h3 id="fx-history-title" className="org-drawer__section">
            <History size={16} aria-hidden="true" /> Revision history
          </h3>
          {f.revisions.length === 0 ? (
            <p className="org-drawer__empty">No published versions yet.</p>
          ) : (
            <ul className="org-drawer__list org-drawer__list--history" data-testid="fixture-history">
              {f.revisions.map((r) => (
                <li key={r.version}>
                  <span className="org-drawer__item">
                    <strong>
                      v{r.version} · {both(r.startsAt, f.timeZone)}
                    </strong>
                    <span>
                      {r.venue} · {r.reason} · {r.author}
                    </span>
                  </span>
                  <time dateTime={r.publishedAt}>{formatAgo(r.publishedAt, now)}</time>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Dialog>
  )
}
