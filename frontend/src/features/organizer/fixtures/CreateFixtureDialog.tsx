import { CircleAlert, X } from 'lucide-react'
import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { describeError } from '../../../api/resource'
import type { NewFixture } from '../api/types'
import { Dialog } from '../components/Dialog'
import { zonedTimeToUtc } from '../format'

/** A competition fixtures can be added to, and the zone its local times are entered in. */
export interface CompetitionOption {
  id: string
  name: string
  timeZone: string
}

interface CreateFixtureDialogProps {
  open: boolean
  competitions: CompetitionOption[]
  onClose: () => void
  /** Resolves once the server has created the fixture. */
  onCreate: (input: NewFixture) => Promise<void>
}

/** New fixture as an unpublished draft; it goes through approval like any change. */
export function CreateFixtureDialog({ open, competitions, onClose, onCreate }: CreateFixtureDialogProps) {
  const id = useId()
  const [chosen, setChosen] = useState('')
  const [home, setHome] = useState('')
  const [away, setAway] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('18:00')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  // The list arrives from the server; default to its first competition.
  const competition = competitions.find((c) => c.id === chosen) ?? competitions[0]

  function reset() {
    setHome('')
    setAway('')
    setDate('')
    setTime('18:00')
    setErrors({})
    setSaveError('')
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const next: Record<string, string> = {}
    if (!competition) next.competition = 'Choose a competition.'
    if (!home.trim()) next.home = 'Enter the home team or player.'
    if (!away.trim()) next.away = 'Enter the away team or player.'
    else if (home.trim().toLowerCase() === away.trim().toLowerCase()) next.away = 'Home and away must be different.'
    if (!date) next.date = 'Choose a date.'
    if (!time) next.time = 'Choose a time.'
    setErrors(next)
    if (Object.keys(next).length || !competition) {
      event.currentTarget.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
      return
    }
    const [y, m, d] = date.split('-').map(Number)
    const [h, min] = time.split(':').map(Number)
    setSaving(true)
    setSaveError('')
    try {
      await onCreate({
        competitionId: competition.id,
        home: home.trim(),
        away: away.trim(),
        startsAt: zonedTimeToUtc(y, m - 1, d, h, min, competition.timeZone).toISOString(),
      })
      reset()
    } catch (failure) {
      setSaveError(describeError(failure, "We couldn't create this fixture. Please try again."))
    } finally {
      setSaving(false)
    }
  }

  const close = () => {
    reset()
    onClose()
  }

  const field = (key: string, label: string, input: ReactNode, wide = false) => (
    <div className={`org-form__field${wide ? ' org-form__field--wide' : ''}${errors[key] ? ' is-invalid' : ''}`}>
      <label htmlFor={`${id}-${key}`}>{label}</label>
      {input}
      {errors[key] && (
        <p className="org-form__error" id={`${id}-${key}-error`}>
          {errors[key]}
        </p>
      )}
    </div>
  )
  const aria = (key: string) => ({ id: `${id}-${key}`, 'aria-invalid': Boolean(errors[key]), 'aria-describedby': errors[key] ? `${id}-${key}-error` : undefined })

  return (
    <Dialog open={open} onClose={close} labelledBy={`${id}-title`}>
      <form className="org-form" onSubmit={submit} noValidate aria-busy={saving}>
        <header className="org-form__head">
          <h2 id={`${id}-title`}>Create Fixture</h2>
          <button type="button" className="org-icon-button" onClick={close} aria-label="Close">
            <X size={22} aria-hidden="true" />
          </button>
        </header>
        <div className="org-form__grid">
          {field(
            'competition',
            'Competition',
            <select {...aria('competition')} value={competition?.id ?? ''} onChange={(e) => setChosen(e.target.value)}>
              {competitions.length === 0 && <option value="">No competitions available</option>}
              {competitions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>,
            true,
          )}
          {field('home', 'Home', <input {...aria('home')} value={home} onChange={(e) => setHome(e.target.value)} data-autofocus />)}
          {field('away', 'Away', <input {...aria('away')} value={away} onChange={(e) => setAway(e.target.value)} />)}
          {field('date', 'Local date', <input {...aria('date')} type="date" value={date} onChange={(e) => setDate(e.target.value)} />)}
          {field('time', 'Local time', <input {...aria('time')} type="time" value={time} onChange={(e) => setTime(e.target.value)} />)}
        </div>
        {competition && (
          <p className="org-form__note">
            Date and time are local to the competition ({competition.timeZone}). The fixture stays a draft until approved and published.
          </p>
        )}
        {saveError && (
          <p className="org-banner org-banner--critical" role="alert">
            <CircleAlert size={20} aria-hidden="true" />
            <span>{saveError}</span>
          </p>
        )}
        <footer className="org-form__actions">
          <button type="button" className="org-btn org-btn--secondary" onClick={close}>
            Cancel
          </button>
          <button type="submit" className="org-btn org-btn--primary" disabled={saving}>
            {saving ? 'Saving…' : 'Create Draft Fixture'}
          </button>
        </footer>
      </form>
    </Dialog>
  )
}
