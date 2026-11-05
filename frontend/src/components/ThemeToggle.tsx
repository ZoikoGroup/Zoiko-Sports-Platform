import { Monitor, Moon, Sun } from 'lucide-react'
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useTheme, type ThemePreference } from '../theme/theme'
import './ThemeToggle.css'

const OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light theme', icon: Sun },
  { value: 'system', label: 'Match system theme', icon: Monitor },
  { value: 'dark', label: 'Dark theme', icon: Moon },
]

const TOUCH_COLLAPSE_MS = 450

/**
 * Light / System / Dark switch. Compact by default (only the active option shows);
 * expands on hover, keyboard focus or tap, and collapses when the pointer leaves,
 * focus moves away, Escape is pressed or the user taps elsewhere.
 *
 * It stays a native radio group (arrow keys, screen readers), and the expanding
 * panel is absolutely positioned inside a fixed-size slot, so opening and closing
 * never moves anything else on the page.
 */
export function ThemeToggle() {
  const { preference, setPreference } = useTheme()
  const [expanded, setExpanded] = useState(false)
  const ref = useRef<HTMLFieldSetElement>(null)
  const lastPointer = useRef<string>('mouse')
  const collapseTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (!expanded) return
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setExpanded(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpanded(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [expanded])

  useEffect(() => () => window.clearTimeout(collapseTimer.current), [])

  const isHoverPointer = (event: ReactPointerEvent) => event.pointerType === 'mouse' || event.pointerType === 'pen'

  function choose(value: ThemePreference) {
    setPreference(value)
    // Touch has no "pointer leaves": close shortly after the choice so it is seen.
    if (lastPointer.current === 'touch') {
      window.clearTimeout(collapseTimer.current)
      collapseTimer.current = window.setTimeout(() => setExpanded(false), TOUCH_COLLAPSE_MS)
    }
  }

  return (
    <div className="theme-toggle-slot">
      <fieldset
        ref={ref}
        className="theme-toggle"
        data-expanded={expanded}
        onPointerEnter={(event) => isHoverPointer(event) && setExpanded(true)}
        onPointerLeave={(event) => {
          if (!isHoverPointer(event)) return
          setExpanded(false)
          // A mouse click leaves focus on the radio; drop it so the panel stays closed.
          if (ref.current?.contains(document.activeElement)) (document.activeElement as HTMLElement).blur()
        }}
        onPointerDown={(event) => {
          lastPointer.current = event.pointerType
          if (event.pointerType === 'touch' && !expanded) setExpanded(true)
        }}
        onFocus={() => setExpanded(true)}
        onBlur={(event) => {
          if (!ref.current?.contains(event.relatedTarget as Node)) setExpanded(false)
        }}
      >
        <legend className="visually-hidden">Colour theme</legend>
        {OPTIONS.map(({ value, label, icon: Icon }) => (
          <label key={value} className="theme-toggle__option" title={label}>
            <input
              type="radio"
              name="theme"
              value={value}
              checked={preference === value}
              onChange={() => choose(value)}
              aria-label={label}
            />
            <span className="theme-toggle__pill">
              <Icon aria-hidden="true" />
            </span>
          </label>
        ))}
      </fieldset>
    </div>
  )
}
