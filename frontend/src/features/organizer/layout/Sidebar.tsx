import { ChevronDown, Trophy, X } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import wordmark from '../../../assets/brand/logo-wordmark.webp'
import { Menu } from '../components/Menu'
import { NAV_GROUPS, organizerPath, type NavItem } from '../navigation'
import { useOrganizerIdentity } from './useWorkspaceSwitch'
import { WorkspaceItems } from './WorkspaceItems'

interface SidebarProps {
  open: boolean
  onNavigate: () => void
  onClose: () => void
  counts: { actionCenter?: number }
}

function NavEntry({ item, counts, onNavigate }: { item: NavItem; counts: SidebarProps['counts']; onNavigate: () => void }) {
  const badge = item.badge ? counts[item.badge] : undefined
  const Icon = item.icon
  return (
    <li>
      <NavLink
        to={organizerPath(item.slug)}
        className={({ isActive }) => ['org-nav__link', isActive && 'is-active'].filter(Boolean).join(' ')}
        onClick={onNavigate}
      >
        <span className="org-nav__icon">
          <Icon size={22} aria-hidden="true" />
        </span>
        <span className="org-nav__label">{item.label}</span>
        {badge ? (
          <span className="org-nav__badge" aria-label={`${badge} open`}>
            {badge}
          </span>
        ) : null}
      </NavLink>
    </li>
  )
}

/** Brand ribbons across the foot of the rail, as in the design. */
function SidebarSwoosh() {
  return (
    <svg className="org-sidebar__swoosh" viewBox="0 0 282 120" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="org-swoosh-gold" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffd60a" />
          <stop offset="1" stopColor="#f5b800" />
        </linearGradient>
        <linearGradient id="org-swoosh-blue" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#2c6cff" />
          <stop offset="1" stopColor="#1d4fe0" />
        </linearGradient>
      </defs>
      <path d="M0 96C70 72 160 50 282 38v20C170 66 84 86 0 112Z" fill="url(#org-swoosh-gold)" />
      <path d="M0 112C90 90 180 72 282 64v56H0Z" fill="url(#org-swoosh-blue)" opacity="0.95" />
    </svg>
  )
}

/** Plum navigation rail: brand, workspace switcher and the five module groups. */
export function Sidebar({ open, onNavigate, onClose, counts }: SidebarProps) {
  const identity = useOrganizerIdentity()

  return (
    <aside className="org-sidebar" data-open={open} aria-label="Organizer navigation">
      <div className="org-sidebar__head">
        <img className="org-sidebar__logo" src={wordmark} width={776} height={228} alt="Zoiko Sports" />
        <button type="button" className="org-sidebar__close" onClick={onClose} aria-label="Close navigation">
          <X size={22} aria-hidden="true" />
        </button>
      </div>

      <Menu
        label="Switch workspace"
        triggerClassName="org-context"
        panelClassName="org-menu__panel--context"
        trigger={
          <>
            <Trophy className="org-context__icon" size={34} strokeWidth={1.8} aria-hidden="true" />
            <span className="org-context__text">
              Competition Workspace
              <span className="visually-hidden"> · {identity.organization}</span>
            </span>
            <ChevronDown size={22} aria-hidden="true" />
          </>
        }
      >
        {(close) => <WorkspaceItems close={close} />}
      </Menu>

      <nav className="org-nav" aria-label="Organizer workspace">
        {NAV_GROUPS.map((group) => (
          <div key={group.title} className="org-nav__group">
            <h2 className="org-nav__heading">{group.title}</h2>
            <ul className="org-nav__list">
              {group.items.map((item) => (
                <NavEntry key={item.slug} item={item} counts={counts} onNavigate={onNavigate} />
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <SidebarSwoosh />
    </aside>
  )
}
