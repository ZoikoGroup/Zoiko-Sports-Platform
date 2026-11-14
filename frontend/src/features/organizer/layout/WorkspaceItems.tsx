import { Check } from 'lucide-react'
import { useOrganizerIdentity, useWorkspaceSwitch } from './useWorkspaceSwitch'

/** Menu items listing the workspaces this account can sign in to. */
export function WorkspaceItems({ close }: { close: () => void }) {
  const identity = useOrganizerIdentity()
  const switchWorkspace = useWorkspaceSwitch()
  return (
    <>
      <p className="org-menu__heading">Switch workspace</p>
      {identity.workspaces.map((w) => {
        const current = w.id === identity.current
        return (
          <button
            key={w.id}
            type="button"
            role="menuitemradio"
            aria-checked={current}
            className="org-menu__item"
            onClick={() => {
              close()
              if (!current) void switchWorkspace(w.id)
            }}
          >
            <span className="org-menu__item-text">
              {w.id === 'organization' ? 'Organizer' : w.label}
              <span className="org-menu__hint">{current ? 'Current workspace' : 'Sign in again to switch'}</span>
            </span>
            {current && <Check size={18} aria-hidden="true" />}
          </button>
        )
      })}
    </>
  )
}
