import { Check } from 'lucide-react'
import { useState } from 'react'
import { contextLabel, humanizeRole } from '../../../auth/roles'
import { useSwitchWorkspace } from '../../../auth/useSwitchWorkspace'
import { useOrganizerIdentity } from './useWorkspaceSwitch'

/**
 * Menu items listing the workspaces this account may act in. Switching keeps
 * the person signed in; the server re-verifies the membership first.
 */
export function WorkspaceItems({ close }: { close: () => void }) {
  const identity = useOrganizerIdentity()
  const switchWorkspace = useSwitchWorkspace()
  const [failed, setFailed] = useState(false)
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
              if (!current) switchWorkspace(w.id).catch(() => setFailed(true))
            }}
          >
            <span className="org-menu__item-text">
              {contextLabel(w)}
              <span className="org-menu__hint">{current ? 'Current workspace' : humanizeRole(w.role)}</span>
            </span>
            {current && <Check size={18} aria-hidden="true" />}
          </button>
        )
      })}
      {failed && (
        <p className="org-menu__hint" role="alert">
          That workspace isn't available any more. Refresh the page to see your workspaces.
        </p>
      )}
    </>
  )
}
