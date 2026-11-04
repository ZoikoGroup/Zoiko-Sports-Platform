/**
 * Light / dark theme.
 *
 * The user's choice is "light", "dark" or "system" (follow the OS). The resolved
 * theme is written to <html data-theme="light|dark">, which all theme tokens in
 * index.css key off. An inline script in index.html applies the same logic before
 * first paint so there is never a flash of the wrong theme.
 *
 * - No stored preference → "system": follows prefers-color-scheme, live.
 * - A manual choice is stored in localStorage and survives reloads.
 */
import { useSyncExternalStore } from 'react'

export type ThemePreference = 'light' | 'dark' | 'system'
export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'zs.theme' // keep in sync with the inline script in index.html
const systemQuery = window.matchMedia('(prefers-color-scheme: dark)')
const listeners = new Set<() => void>()

function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    /* storage unavailable: behave as "system" */
  }
  return 'system'
}

let preference = readPreference()

const resolve = (pref: ThemePreference): Theme => (pref === 'system' ? (systemQuery.matches ? 'dark' : 'light') : pref)

function apply(animate: boolean) {
  const next = resolve(preference)
  const root = document.documentElement
  if (root.dataset.theme === next) return
  const commit = () => {
    root.dataset.theme = next
  }
  // Cross-fade the whole page (gradients and images included) where supported.
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (animate && !reduceMotion && 'startViewTransition' in document) {
    document.startViewTransition(commit)
  } else {
    commit()
  }
}

function notify() {
  listeners.forEach((listener) => listener())
}

export function setThemePreference(next: ThemePreference) {
  preference = next
  try {
    if (next === 'system') localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, next)
  } catch {
    /* storage unavailable: the choice still applies for this visit */
  }
  apply(true)
  notify()
}

// Follow the operating system while no manual choice is set.
systemQuery.addEventListener('change', () => {
  if (preference === 'system') apply(true)
  notify()
})

// Another tab changed the preference.
window.addEventListener('storage', (event) => {
  if (event.key !== STORAGE_KEY) return
  preference = readPreference()
  apply(true)
  notify()
})

apply(false)

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Current preference and resolved theme, re-rendering on any change. */
export function useTheme() {
  const pref = useSyncExternalStore(subscribe, () => preference)
  const theme = useSyncExternalStore(subscribe, () => resolve(preference))
  return { preference: pref, theme, setPreference: setThemePreference }
}
