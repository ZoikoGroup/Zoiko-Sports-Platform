import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../auth/AuthContext'

/** The signed-in user, the active organization and every workspace they may switch to, for the shell chrome. */
export function useOrganizerIdentity() {
  const { session } = useAuth()
  if (!session?.authenticated || !session.context) throw new Error('Organizer shell rendered without a workspace')
  return {
    name: session.user.full_name || session.user.email,
    email: session.user.email,
    role: session.context.role ?? 'organizer',
    organization: session.context.organization?.name ?? '',
    current: session.context.id,
    workspaces: session.contexts,
  }
}

export function useSignOut() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  return useCallback(async () => {
    await logout().catch(() => undefined)
    navigate('/login', { replace: true })
  }, [logout, navigate])
}
