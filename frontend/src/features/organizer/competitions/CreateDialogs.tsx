import { X } from 'lucide-react'
import { useId, useState, type FormEvent, type ReactNode } from 'react'
import type { Competition, CompetitionEvent, CompetitionEventStatus, CountryCode, SportId } from '../api/types'
import { Dialog } from '../components/Dialog'
import { COUNTRIES } from '../countries'
import { SPORT_LABELS } from '../format'
import { EVENT_STATUS_LABELS } from './shared'

/** Noon UTC on a picked day, so the date reads the same in every time zone. */
const middayUtc = (date: string) => new Date(`${date}T12:00:00Z`).toISOString()

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

function DialogFrame({ titleId, title, onClose, onSubmit, submitLabel, children }: { titleId: string; title: string; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; submitLabel: string; children: ReactNode }) {
  return (
    <form className="org-form" onSubmit={onSubmit} noValidate>
      <header className="org-form__head">
        <h2 id={titleId}>{title}</h2>
        <button type="button" className="org-icon-button" onClick={onClose} aria-label="Close">
          <X size={22} aria-hidden="true" />
        </button>
      </header>
      <div className="org-form__grid">{children}</div>
      <p className="org-form__note">Demo data: what you add here stays in this tab until you reload.</p>
      <footer className="org-form__actions">
        <button type="button" className="org-btn org-btn--secondary" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="org-btn org-btn--primary">
          {submitLabel}
        </button>
      </footer>
    </form>
  )
}

const SPORTS = Object.keys(SPORT_LABELS) as SportId[]

interface CreateCompetitionProps {
  open: boolean
  onClose: () => void
  onCreate: (input: Pick<Competition, 'name' | 'sport' | 'country' | 'startsAt' | 'endsAt'>) => void
}

export function CreateCompetitionDialog({ open, onClose, onCreate }: CreateCompetitionProps) {
  const id = useId()
  const [name, setName] = useState('')
  const [sport, setSport] = useState<SportId>('soccer')
  const [country, setCountry] = useState<CountryCode>('US')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

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
    onCreate({ name: name.trim(), sport, country, startsAt: middayUtc(start), endsAt: middayUtc(end) })
    reset()
  }

  const close = () => {
    reset()
    onClose()
  }

  return (
    <Dialog open={open} onClose={close} labelledBy={`${id}-title`}>
      <DialogFrame titleId={`${id}-title`} title="Create Competition" onClose={close} onSubmit={submit} submitLabel="Create as Draft">
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
  onCreate: (competitionId: string, event: Omit<CompetitionEvent, 'id'>) => void
}

export function CreateEventDialog({ open, competitions, onClose, onCreate }: CreateEventProps) {
  const id = useId()
  const [competitionId, setCompetitionId] = useState(competitions[0]?.id ?? '')
  const [name, setName] = useState('')
  const [venue, setVenue] = useState('')
  const [date, setDate] = useState('')
  const [status, setStatus] = useState<CompetitionEventStatus>('planning')
  const [errors, setErrors] = useState<Record<string, string>>({})

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
    onCreate(competitionId, { name: name.trim(), venue: venue.trim(), startsAt: middayUtc(date), status })
    reset()
  }

  const close = () => {
    reset()
    onClose()
  }

  return (
    <Dialog open={open} onClose={close} labelledBy={`${id}-title`}>
      <DialogFrame titleId={`${id}-title`} title="Create Event" onClose={close} onSubmit={submit} submitLabel="Create Event">
        <Field id={`${id}-competition`} label="Competition" error={errors.competition}>
          <select id={`${id}-competition`} value={competitionId} onChange={(e) => setCompetitionId(e.target.value)} aria-invalid={Boolean(errors.competition)}>
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
