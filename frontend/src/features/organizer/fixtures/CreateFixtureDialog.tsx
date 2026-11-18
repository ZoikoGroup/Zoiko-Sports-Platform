import { X } from 'lucide-react'
import { useId, useState, type FormEvent, type ReactNode } from 'react'
import type { Fixture } from '../api/types'
import { Dialog } from '../components/Dialog'
import { zonedTimeToUtc } from '../format'

export interface CompetitionOption {
  id: string
  name: string
  /** A fixture of this competition to copy sport, place and recipients from. */
  template: Fixture
}

interface CreateFixtureDialogProps {
  open: boolean
  competitions: CompetitionOption[]
  onClose: () => void
  onCreate: (input: { competitionId: string; home: string; away: string; startsAt: string; venue: string }) => void
}

/** New fixture as an unpublished draft (v1); it goes through approval like any change. */
export function CreateFixtureDialog({ open, competitions, onClose, onCreate }: CreateFixtureDialogProps) {
  const id = useId()
  const [competitionId, setCompetitionId] = useState(competitions[0]?.id ?? '')
  const [home, setHome] = useState('')
  const [away, setAway] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('18:00')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const template = competitions.find((c) => c.id === competitionId)?.template

  function reset() {
    setHome('')
    setAway('')
    setDate('')
    setTime('18:00')
    setErrors({})
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const next: Record<string, string> = {}
    if (!home.trim()) next.home = 'Enter the home team or player.'
    if (!away.trim()) next.away = 'Enter the away team or player.'
    else if (home.trim().toLowerCase() === away.trim().toLowerCase()) next.away = 'Home and away must be different.'
    if (!date) next.date = 'Choose a date.'
    if (!time) next.time = 'Choose a time.'
    setErrors(next)
    if (Object.keys(next).length || !template) {
      event.currentTarget.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
      return
    }
    const [y, m, d] = date.split('-').map(Number)
    const [h, min] = time.split(':').map(Number)
    onCreate({
      competitionId,
      home: home.trim(),
      away: away.trim(),
      startsAt: zonedTimeToUtc(y, m - 1, d, h, min, template.timeZone).toISOString(),
      venue: (template.revisions[0] ?? template.change)!.venue,
    })
    reset()
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
      <form className="org-form" onSubmit={submit} noValidate>
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
            <select {...aria('competition')} value={competitionId} onChange={(e) => setCompetitionId(e.target.value)}>
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
        {template && (
          <p className="org-form__note">
            Venue and time zone follow the competition: {(template.revisions[0] ?? template.change)!.venue}, {template.city} ({template.timeZone}). The fixture stays a draft until approved and published.
          </p>
        )}
        <footer className="org-form__actions">
          <button type="button" className="org-btn org-btn--secondary" onClick={close}>
            Cancel
          </button>
          <button type="submit" className="org-btn org-btn--primary">
            Create Draft Fixture
          </button>
        </footer>
      </form>
    </Dialog>
  )
}
