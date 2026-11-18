import { Bell, Check, ChevronDown, CircleHelp, Globe, LogOut, Menu as MenuIcon, Monitor, Moon, Search, Sun } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTheme, type ThemePreference } from '../../../theme/theme'
import type { RegionId } from '../api/types'
import { Menu } from '../components/Menu'
import { formatRelativeDay, humanizeRole, initials, REGION_LABELS, SPORT_LABELS } from '../format'
import { ALL_ITEMS, organizerPath } from '../navigation'
import type { OrganizerShell } from '../shellContext'
import { useOrganizerIdentity, useSignOut } from './useWorkspaceSwitch'

interface TopbarProps {
  shell: OrganizerShell
  onOpenNavigation: () => void
}

const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
const SHORTCUT = IS_MAC ? 'Meta+K' : 'Control+K'

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'dark', label: 'Dark', icon: Moon },
]

interface SearchResult {
  key: string
  label: string
  detail: string
  to: string
}

/** Search across this workspace's events and modules; Ctrl/⌘ K focuses it. */
function GlobalSearch({ shell }: { shell: OrganizerShell }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const blurTimer = useRef<number | undefined>(undefined)
  const listId = useId()
  const navigate = useNavigate()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Not while a modal dialog is open: the page behind it is inert.
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && !document.querySelector('dialog[open]')) {
        event.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.clearTimeout(blurTimer.current)
    }
  }, [])

  const results = useMemo<SearchResult[]>(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const events = (shell.overview.data?.upcomingEvents ?? [])
      .filter((e) => [e.name, e.city, e.country, SPORT_LABELS[e.sport], REGION_LABELS[e.region]].some((v) => v.toLowerCase().includes(q)))
      .map((e) => ({
        key: e.id,
        label: e.name,
        detail: `Event · ${e.city}, ${e.country}`,
        to: `${organizerPath('competitions')}?event=${e.id}`,
      }))
    const modules = ALL_ITEMS
      .filter((m) => m.label.toLowerCase().includes(q))
      .map((m) => ({ key: m.slug, label: m.label, detail: 'Page', to: organizerPath(m.slug) }))
    return [...events, ...modules].slice(0, 8)
  }, [query, shell.overview.data])

  const go = (result: SearchResult) => {
    setOpen(false)
    setQuery('')
    inputRef.current?.blur()
    navigate(result.to)
  }

  const showList = open && query.trim().length > 0

  return (
    <form
      className="org-search"
      role="search"
      onSubmit={(event) => {
        event.preventDefault()
        if (results[active]) go(results[active])
      }}
    >
      <Search className="org-search__icon" size={22} aria-hidden="true" />
      <label className="visually-hidden" htmlFor={`${listId}-input`}>
        Search competitions, events, teams, venues or organizations
      </label>
      <input
        ref={inputRef}
        id={`${listId}-input`}
        type="search"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList && results[active] ? `${listId}-${active}` : undefined}
        aria-keyshortcuts={SHORTCUT}
        autoComplete="off"
        placeholder="Search competitions, events, teams, venues or organizations..."
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setActive(0)
          setOpen(true)
        }}
        onFocus={() => {
          window.clearTimeout(blurTimer.current)
          setOpen(true)
        }}
        // Deferred so a click on a result lands first; cancelled if focus returns.
        onBlur={() => {
          blurTimer.current = window.setTimeout(() => setOpen(false), 120)
        }}
        onKeyDown={(event) => {
          if (!showList) return
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setActive((i) => Math.min(i + 1, results.length - 1))
          } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            setActive((i) => Math.max(i - 1, 0))
          } else if (event.key === 'Escape') {
            setOpen(false)
          }
        }}
      />
      {showList && (
        <ul className="org-search__results" id={listId} role="listbox" aria-label="Search results">
          {results.length === 0 && (
            <li className="org-search__empty" role="presentation">
              No matches for “{query.trim()}”
            </li>
          )}
          {results.map((result, index) => (
            <li
              key={result.key}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              className="org-search__result"
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => go(result)}
              onPointerEnter={() => setActive(index)}
            >
              <span className="org-search__result-label">{result.label}</span>
              <span className="org-search__result-detail">{result.detail}</span>
            </li>
          ))}
        </ul>
      )}
    </form>
  )
}

/** Header: search, region scope, notifications, help and the account menu. */
export function Topbar({ shell, onOpenNavigation }: TopbarProps) {
  const identity = useOrganizerIdentity()
  const signOut = useSignOut()
  const { preference, setPreference } = useTheme()
  const notifications = shell.overview.data?.notifications ?? []
  const unread = notifications.filter((n) => n.unread).length
  const regionLabel = shell.region === 'all' ? 'All Regions' : REGION_LABELS[shell.region]

  return (
    <header className="org-topbar">
      <button type="button" className="org-topbar__menu" onClick={onOpenNavigation} aria-label="Open navigation">
        <MenuIcon size={24} aria-hidden="true" />
      </button>

      <GlobalSearch shell={shell} />

      <div className="org-topbar__controls">
        <Menu
          label={`Region: ${regionLabel}`}
          triggerClassName="org-select"
          trigger={
            <>
              <Globe size={22} aria-hidden="true" />
              <span className="org-select__text">{regionLabel}</span>
              <ChevronDown size={18} aria-hidden="true" />
            </>
          }
        >
          {(close) =>
            (['all', ...Object.keys(REGION_LABELS)] as (RegionId | 'all')[]).map((region) => (
              <button
                key={region}
                type="button"
                role="menuitemradio"
                aria-checked={shell.region === region}
                className="org-menu__item"
                onClick={() => {
                  shell.setRegion(region)
                  close()
                }}
              >
                <span className="org-menu__item-text">{region === 'all' ? 'All Regions' : REGION_LABELS[region]}</span>
                {shell.region === region && <Check size={18} aria-hidden="true" />}
              </button>
            ))
          }
        </Menu>

        <Menu
          label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
          kind="dialog"
          align="end"
          triggerClassName="org-icon-button"
          panelClassName="org-notifications"
          trigger={
            <>
              <Bell size={24} aria-hidden="true" />
              {unread > 0 && (
                <span className="org-icon-button__count" aria-hidden="true">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </>
          }
        >
          {(close) => (
            <>
              <div className="org-notifications__head">
                <h2>Notifications</h2>
                <span>{unread} unread</span>
              </div>
              <ul className="org-notifications__list">
                {notifications.map((n) => (
                  <li key={n.id} className={n.unread ? 'is-unread' : undefined}>
                    <span className="org-notifications__title">{n.title}</span>
                    <span className="org-notifications__detail">{n.detail}</span>
                    <span className="org-notifications__time">{formatRelativeDay(n.createdAt)}</span>
                  </li>
                ))}
                {notifications.length === 0 && <li>You're all caught up.</li>}
              </ul>
              <Link className="org-notifications__all" to={organizerPath('action-center')} onClick={close}>
                Open Action Center
              </Link>
            </>
          )}
        </Menu>

        <Link className="org-icon-button" to={organizerPath('help')} aria-label="Help & Support">
          <CircleHelp size={24} aria-hidden="true" />
        </Link>

        <span className="org-topbar__rule" aria-hidden="true" />

        <Menu
          label={`Account: ${identity.name}`}
          align="end"
          triggerClassName="org-user"
          trigger={
            <>
              <span className="org-user__avatar" aria-hidden="true">
                {initials(identity.name)}
              </span>
              <span className="org-user__text">
                <span className="org-user__name" data-testid="organizer-user-name">
                  {identity.name}
                </span>
                <span className="org-user__role">{humanizeRole(identity.role)}</span>
              </span>
              <ChevronDown className="org-user__chevron" size={20} aria-hidden="true" />
            </>
          }
        >
          {(close) => (
            <>
              <div className="org-menu__identity" role="presentation">
                <strong>{identity.name}</strong>
                <span>{identity.email}</span>
                <span>
                  {humanizeRole(identity.role)} · {identity.organization}
                </span>
              </div>
              <p className="org-menu__heading">Appearance</p>
              {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  role="menuitemradio"
                  aria-checked={preference === value}
                  className="org-menu__item"
                  onClick={() => setPreference(value)}
                >
                  <Icon size={18} aria-hidden="true" />
                  <span className="org-menu__item-text">{label} theme</span>
                  {preference === value && <Check size={18} aria-hidden="true" />}
                </button>
              ))}
              <hr className="org-menu__rule" />
              <button
                type="button"
                role="menuitem"
                className="org-menu__item"
                onClick={() => {
                  close()
                  void signOut()
                }}
              >
                <LogOut size={18} aria-hidden="true" />
                <span className="org-menu__item-text">Sign out</span>
              </button>
            </>
          )}
        </Menu>
      </div>
    </header>
  )
}
