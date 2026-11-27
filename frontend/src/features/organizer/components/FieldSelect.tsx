/** A labelled native dropdown in the Organizer filter style (`accent` = the highlighted first filter). */
export function FieldSelect({
  label,
  value,
  options,
  onChange,
  accent = false,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
  accent?: boolean
}) {
  return (
    <span className={`org-field-select${accent ? ' org-field-select--accent' : ''}`}>
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="m6 9 6 6 6-6" />
      </svg>
    </span>
  )
}
