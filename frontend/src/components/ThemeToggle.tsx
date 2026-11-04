import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme, type ThemePreference } from '../theme/theme'
import './ThemeToggle.css'

const OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light theme', icon: Sun },
  { value: 'system', label: 'Match system theme', icon: Monitor },
  { value: 'dark', label: 'Dark theme', icon: Moon },
]

/** Light / System / Dark switch: a native radio group, so arrow keys move between options. */
export function ThemeToggle() {
  const { preference, setPreference } = useTheme()
  return (
    <fieldset className="theme-toggle">
      <legend className="visually-hidden">Colour theme</legend>
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <label key={value} className="theme-toggle__option" title={label}>
          <input
            type="radio"
            name="theme"
            value={value}
            checked={preference === value}
            onChange={() => setPreference(value)}
            aria-label={label}
          />
          <Icon aria-hidden="true" />
        </label>
      ))}
    </fieldset>
  )
}
