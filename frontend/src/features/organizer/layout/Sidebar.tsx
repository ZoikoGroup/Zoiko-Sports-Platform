import { BadgeCheck, ChevronDown, ChevronRight, Layers, X } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import wordmark from '../../../assets/brand/logo-wordmark.webp'
import { Menu } from '../components/Menu'
import { ADDITIONAL_WORKSPACES, itemNumber, organizerPath, UTILITY_ITEMS, WORKSPACE_ITEMS, type NavItem } from '../navigation'
import { useOrganizerIdentity } from './useWorkspaceSwitch'
import { WorkspaceItems } from './WorkspaceItems'

interface SidebarProps {
  open: boolean
  onNavigate: () => void
  onClose: () => void
  counts: { actionCenter?: number }
}

function NavEntry({ item, counts, onNavigate }: { item: NavItem; counts: SidebarProps['counts']; onNavigate: () => void }) {
  const number = itemNumber(item)
  const badge = item.badge ? counts[item.badge] : undefined
  const Icon = item.icon
  return (
    <li>
      <NavLink
        to={organizerPath(item.slug)}
        className={({ isActive }) => ['org-nav__link', item.accent && 'org-nav__link--workspace', isActive && 'is-active'].filter(Boolean).join(' ')}
        onClick={onNavigate}
      >
        <span className={item.accent ? `org-nav__tile org-nav__tile--${item.accent}` : 'org-nav__icon'}>
          <Icon size={item.accent ? 17 : 19} aria-hidden="true" />
        </span>
        <span className="org-nav__label">
          {number && <span className="org-nav__number">{number}. </span>}
          {item.label}
        </span>
        {badge ? (
          <span className="org-nav__badge" aria-label={`${badge} open`}>
            {badge}
          </span>
        ) : null}
        {item.accent && <ChevronRight className="org-nav__chevron" size={18} aria-hidden="true" />}
      </NavLink>
    </li>
  )
}

/** Plum navigation rail: brand, workspace context, the 13 modules and the other workspaces. */
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
            <Layers className="org-context__icon" size={26} aria-hidden="true" />
            <span className="org-context__text">
              <span className="org-context__title">Competition Workspace</span>
              <span className="org-context__sub">Organizer · {identity.organization}</span>
            </span>
            <ChevronDown size={18} aria-hidden="true" />
          </>
        }
      >
        {(close) => <WorkspaceItems close={close} />}
      </Menu>

      <nav className="org-nav" aria-label="Organizer workspace">
        <h2 className="org-nav__heading">Organizer Workspace (01 – 13)</h2>
        <ul className="org-nav__list">
          {WORKSPACE_ITEMS.map((item) => (
            <NavEntry key={item.slug} item={item} counts={counts} onNavigate={onNavigate} />
          ))}
        </ul>

        <h2 className="org-nav__heading org-nav__heading--rule">Additional Workspaces (14 – 16)</h2>
        <ul className="org-nav__list">
          {ADDITIONAL_WORKSPACES.map((item) => (
            <NavEntry key={item.slug} item={item} counts={counts} onNavigate={onNavigate} />
          ))}
        </ul>

        <ul className="org-nav__list org-nav__list--utility">
          {UTILITY_ITEMS.map((item) => (
            <NavEntry key={item.slug} item={item} counts={counts} onNavigate={onNavigate} />
          ))}
        </ul>
      </nav>

      <NavLink to={organizerPath('settings')} className="org-account" onClick={onNavigate}>
        <span className="org-account__avatar" aria-hidden="true">
          {identity.organization.charAt(0).toUpperCase() || 'Z'}
        </span>
        <span className="org-account__name">{identity.organization}</span>
        <BadgeCheck className="org-account__verified" size={20} aria-label="Active organization" />
        <ChevronRight size={18} aria-hidden="true" />
      </NavLink>
    </aside>
  )
}
