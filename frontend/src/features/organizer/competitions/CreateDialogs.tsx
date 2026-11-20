import { CircleAlert, X } from 'lucide-react'
import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { describeError } from '../../../api/resource'
import type { Competition, CompetitionEventStatus, CountryCode, NewCompetition, NewCompetitionEvent, SportId } from '../api/types'
import { Dialog } from '../components/Dialog'
import { COUNTRIES } from '../countries'
import { SPORT_LABELS } from '../format'
import { EVENT_STATUS_LABELS } from './shared'

const SAVE_FAILED = "We couldn't save this. Please try again."

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: ReactNode }) {
  return (
    <div className={`org-form__field${error ? ' is-invalid' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {children}
      {error && (
        <p className="org-form__error" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  )
}

interface DialogFrameProps {
  titleId: string
  title: string
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  submitLabel: string
  saving: boolean
  /** Why the server did not accept the submission. */
  error: string
  children: ReactNode
}

function DialogFrame({ titleId, title, onClose, onSubmit, submitLabel, saving, error, children }: DialogFrameProps) {
  return (
    <form className="org-form" onSubmit={onSubmit} noValidate aria-busy={saving}>
      <header className="org-form__head">
        <h2 id={titleId}>{title}</h2>
        <button type="button" className="org-icon-button" onClick={onClose} aria-label="Close">
          <X size={22} aria-hidden="true" />
        </button>
      </header>
      <div className="org-form__grid">{children}</div>
      {error && (
        <p className="org-banner org-banner--critical" role="alert">
          <CircleAlert size={20} aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
      <footer className="org-form__actions">
        <button type="button" className="org-btn org-btn--secondary" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="org-btn org-btn--primary" disabled={saving}>
          {saving ? 'Saving…' : submitLabel}
        </button>
      </footer>
    </form>
  )
}

/** Sends a validated form to the server; the dialog stays open with the reason if it is not accepted. */
function useSubmission<T>(save: (input: T) => Promise<void>, onSaved: () => void) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  async function submit(input: T) {
    setSaving(true)
    setError('')
    try {
      await save(input)
      onSaved()
    } catch (failure) {
      setError(describeError(failure, SAVE_FAILED))
    } finally {
      setSaving(false)
    }
  }
  return { saving, error, submit, clearError: () => setError('') }
}

const SPORTS = Object.keys(SPORT_LABELS) as SportId[]

interface CreateCompetitionProps {
  open: boolean
  onClose: () => void
  /** Resolves once the server has created the competition. */
  onCreate: (input: NewCompetition) => Promise<void>
}

export function CreateCompetitionDialog({ open, onClose, onCreate }: CreateCompetitionProps) {
  const id = useId()
  const [name, setName] = useState('')
  const [sport, setSport] = useState<SportId>('soccer')
  const [country, setCountry] = useState<CountryCode>('US')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const submission = useSubmission(onCreate, reset)

  function reset() {
    setName('')
    setStart('')
    setEnd('')
    setErrors({})
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const next: Record<string, string> = {}
    if (!name.trim()) next.name = 'Enter a competition name.'
    if (!start) next.start = 'Choose a start date.'
    if (!end) next.end = 'Choose an end date.'
    else if (start && end < start) next.end = 'The end date must be on or after the start date.'
    setErrors(next)
    if (Object.keys(next).length) {
      event.currentTarget.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
      return
    }
    void submission.submit({ name: name.trim(), sport, country, startDate: start, endDate: end })
  }

  const close = () => {
    reset()
    submission.clearError()
    onClose()
  }

  return (
    <Dialog open={open} onClose={close} labelledBy={`${id}-title`}>
      <DialogFrame titleId={`${id}-title`} title="Create Competition" onClose={close} onSubmit={submit} submitLabel="Create as Draft" saving={submission.saving} error={submission.error}>
        <Field id={`${id}-name`} label="Competition name" error={errors.name}>
          <input id={`${id}-name`} value={name} onChange={(e) => setName(e.target.value)} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? `${id}-name-error` : undefined} data-autofocus />
        </Field>
        <Field id={`${id}-sport`} label="Sport">
          <select id={`${id}-sport`} value={sport} onChange={(e) => setSport(e.target.value as SportId)}>
            {SPORTS.map((s) => (
              <option key={s} value={s}>
                {SPORT_LABELS[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field id={`${id}-country`} label="Country">
          <select id={`${id}-country`} value={country} onChange={(e) => setCountry(e.target.value as CountryCode)}>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field id={`${id}-start`} label="Start date" error={errors.start}>
          <input id={`${id}-start`} type="date" value={start} onChange={(e) => setStart(e.target.value)} aria-invalid={Boolean(errors.start)} aria-describedby={errors.start ? `${id}-start-error` : undefined} />
        </Field>
        <Field id={`${id}-end`} label="End date" error={errors.end}>
          <input id={`${id}-end`} type="date" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} aria-invalid={Boolean(errors.end)} aria-describedby={errors.end ? `${id}-end-error` : undefined} />
        </Field>
      </DialogFrame>
    </Dialog>
  )
}

interface CreateEventProps {
  open: boolean
  competitions: Competition[]
  onClose: () => void
  /** Resolves once the server has created the event. */
  onCreate: (input: NewCompetitionEvent) => Promise<void>
}

export function CreateEventDialog({ open, competitions, onClose, onCreate }: CreateEventProps) {
  const id = useId()
  const [chosen, setChosen] = useState('')
  const [name, setName] = useState('')
  const [venue, setVenue] = useState('')
  const [date, setDate] = useState('')
  const [status, setStatus] = useState<CompetitionEventStatus>('planning')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const submission = useSubmission(onCreate, reset)
  // The list arrives from the server; default to its first competition.
  const competitionId = competitions.some((c) => c.id === chosen) ? chosen : (competitions[0]?.id ?? '')

  function reset() {
    setName('')
    setVenue('')
    setDate('')
    setStatus('planning')
    setErrors({})
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const next: Record<string, string> = {}
    if (!competitionId) next.competition = 'Choose a competition.'
    if (!name.trim()) next.name = 'Enter an event name.'
    if (!venue.trim()) next.venue = 'Enter a venue.'
    if (!date) next.date = 'Choose a date.'
    setErrors(next)
    if (Object.keys(next).length) {
      event.currentTarget.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
      return
    }
    void submission.submit({ competitionId, name: name.trim(), venue: venue.trim(), date, status })
  }

  const close = () => {
    reset()
    submission.clearError()
    onClose()
  }

  return (
    <Dialog open={open} onClose={close} labelledBy={`${id}-title`}>
      <DialogFrame titleId={`${id}-title`} title="Create Event" onClose={close} onSubmit={submit} submitLabel="Create Event" saving={submission.saving} error={submission.error}>
        <Field id={`${id}-competition`} label="Competition" error={errors.competition}>
          <select
            id={`${id}-competition`}
            value={competitionId}
            onChange={(e) => setChosen(e.target.value)}
            aria-invalid={Boolean(errors.competition)}
            aria-describedby={errors.competition ? `${id}-competition-error` : undefined}
          >
            {competitions.length === 0 && <option value="">No competitions available</option>}
            {competitions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field id={`${id}-name`} label="Event name" error={errors.name}>
          <input id={`${id}-name`} value={name} onChange={(e) => setName(e.target.value)} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? `${id}-name-error` : undefined} data-autofocus />
        </Field>
        <Field id={`${id}-venue`} label="Venue" error={errors.venue}>
          <input id={`${id}-venue`} value={venue} onChange={(e) => setVenue(e.target.value)} aria-invalid={Boolean(errors.venue)} aria-describedby={errors.venue ? `${id}-venue-error` : undefined} />
        </Field>
        <Field id={`${id}-date`} label="Date" error={errors.date}>
          <input id={`${id}-date`} type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-invalid={Boolean(errors.date)} aria-describedby={errors.date ? `${id}-date-error` : undefined} />
        </Field>
        <Field id={`${id}-status`} label="Status">
          <select id={`${id}-status`} value={status} onChange={(e) => setStatus(e.target.value as CompetitionEventStatus)}>
            {(Object.keys(EVENT_STATUS_LABELS) as CompetitionEventStatus[]).map((s) => (
              <option key={s} value={s}>
                {EVENT_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </Field>
      </DialogFrame>
    </Dialog>
  )
}
