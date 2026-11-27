import { ArrowRight, LogOut } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { SignedInSession } from '../api/auth'
import { ApiError } from '../api/client'
import { accountTypeLabel } from '../auth/accountTypes'
import { useAuth } from '../auth/AuthContext'
import { contextLabel, homePathFor, roleLabel } from '../auth/roles'
import { useSwitchWorkspace } from '../auth/useSwitchWorkspace'
import { CardHeader } from '../components/CardHeader'
import { Alert } from '../components/form/Alert'
import { Button } from '../components/form/Button'
import './pages.css'

/**
 * Shown to a signed-in person without an active workspace: several to choose
 * from, or none (no-access). Workspaces come only from the server's verified
 * memberships, so nothing here can grant access.
 */
export function ChooseWorkspacePage() {
  const { session, logout, unmatchedTile } = useAuth()
  const navigate = useNavigate()
  const switchWorkspace = useSwitchWorkspace()
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const current = session as SignedInSession
  const noAccess = current.contexts.length === 0

  async function choose(contextId: string) {
    setPending(contextId)
    setError(null)
    try {
      await switchWorkspace(contextId)
    } catch (failure) {
      setPending(null)
      setError(failure instanceof ApiError ? failure.message : 'Something went wrong. Please try again.')
    }
  }

  async function signOut() {
    await logout().catch(() => undefined)
    navigate('/login', { replace: true })
  }

  return (
    <>
      <CardHeader
        title={noAccess ? 'No workspace yet' : 'Choose a workspace'}
        subtitle={noAccess ? undefined : `Signed in as ${current.user.email}.`}
        documentTitle="Choose a workspace"
      />
      {current.context && (
        <p className="auth-form__note">
          You're in {contextLabel(current.context)}.{' '}
          <button type="button" className="link-button" onClick={() => navigate(homePathFor(current))}>
            Stay here
          </button>
        </p>
      )}
      {current.context_ended && (
        <Alert tone="info">Your access to the previous workspace has ended. Choose another workspace to continue.</Alert>
      )}
      {unmatchedTile && !noAccess && (
        <Alert tone="info">
          This account doesn't have a {accountTypeLabel(unmatchedTile)} workspace. Choose one of your workspaces.
        </Alert>
      )}
      {error && <Alert tone="error">{error}</Alert>}

      {noAccess ? (
        <Alert tone="info">
          Your account doesn't have access to any workspace yet. If an organization invited you, open the invitation
          link from your email.
        </Alert>
      ) : (
        <ul className="workspace-choices" aria-label="Your workspaces">
          {current.contexts.map((context) => {
            const isCurrent = context.id === current.context?.id
            return (
              <li key={context.id}>
                <button
                  type="button"
                  className="workspace-choice"
                  onClick={() => (isCurrent ? navigate(homePathFor(current)) : void choose(context.id))}
                  disabled={pending !== null}
                  aria-current={isCurrent || undefined}
                >
                  <span className="workspace-choice__text">
                    <span className="workspace-choice__name">{contextLabel(context)}</span>
                    {context.role && <span className="workspace-choice__role">{roleLabel(context)}</span>}
                  </span>
                  <ArrowRight size={20} aria-hidden="true" />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <Button
        variant="secondary"
        onClick={signOut}
        trailingIcon={<LogOut size={18} aria-hidden="true" />}
        className="workspace-signout"
      >
        Sign out
      </Button>
    </>
  )
}
