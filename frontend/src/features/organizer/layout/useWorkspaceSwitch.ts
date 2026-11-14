import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import type { AccountTypeId } from '../../../api/auth'
import { ACCOUNT_TYPES, rememberAccountType } from '../../../auth/accountTypes'
import { useAuth } from '../../../auth/AuthContext'
import { activeMembership } from '../../../auth/roles'

/** The signed-in user, organization and workspaces, for the shell chrome. */
export function useOrganizerIdentity() {
  const { session } = useAuth()
  if (!session?.authenticated) throw new Error('Organizer shell rendered without a session')
  const membership = activeMembership(session)
  return {
    name: session.user.full_name || session.user.email,
    email: session.user.email,
    role: membership?.role ?? 'organizer',
    organization: membership?.organization_name ?? '',
    current: session.account_type,
    workspaces: ACCOUNT_TYPES.filter((t) => session.available_account_types.includes(t.id)),
  }
}

/**
 * A session is scoped to one workspace, so switching means signing in again:
 * remember the chosen workspace (pre-selected on the sign-in page), end this
 * session and go to sign-in.
 */
export function useWorkspaceSwitch() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  return useCallback(
    async (type: AccountTypeId) => {
      rememberAccountType(type)
      // If sign-out fails the session is still live and sign-in sends the user back.
      await logout().catch(() => undefined)
      navigate('/login', { replace: true })
    },
    [logout, navigate],
  )
}

export function useSignOut() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  return useCallback(async () => {
    await logout().catch(() => undefined)
    navigate('/login', { replace: true })
  }, [logout, navigate])
}
