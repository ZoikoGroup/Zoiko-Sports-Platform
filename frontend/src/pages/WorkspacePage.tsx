import { ArrowLeftRight, LogOut } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { SignedInSession } from '../api/auth'
import { accountTypeLabel } from '../auth/accountTypes'
import { useAuth } from '../auth/AuthContext'
import { CHOOSE_WORKSPACE, roleLabel } from '../auth/roles'
import { CardHeader } from '../components/CardHeader'
import { Alert } from '../components/form/Alert'
import { Button } from '../components/form/Button'
import './pages.css'

/** Signed-in landing: confirms which workspace (context) the session acts in. */
export function WorkspacePage() {
  const { session, logout, unmatchedTile } = useAuth()
  const navigate = useNavigate()
  const [signingOut, setSigningOut] = useState(false)
  const current = session as SignedInSession
  // The gate admits this page only with an active context.
  const context = current.context!

  async function signOut() {
    setSigningOut(true)
    try {
      await logout()
      navigate('/login', { replace: true })
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <>
      <CardHeader
        title={`Welcome, ${current.user.full_name || current.user.email}`}
        subtitle="You're signed in to Zoiko Sports."
        documentTitle="Workspace"
      />
      {unmatchedTile && (
        <Alert tone="info">
          This account doesn't have a {accountTypeLabel(unmatchedTile)} workspace, so you're in your{' '}
          {accountTypeLabel(context.account_type)} workspace.
        </Alert>
      )}
      <dl className="workspace-summary" aria-label="Current session">
        <div>
          <dt>Workspace</dt>
          <dd data-testid="workspace-type">{accountTypeLabel(context.account_type)}</dd>
        </div>
        {context.organization && (
          <>
            <div>
              <dt>Organization</dt>
              <dd data-testid="workspace-organization">{context.organization.name}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>{roleLabel(context)}</dd>
            </div>
          </>
        )}
        <div>
          <dt>Signed in as</dt>
          <dd>{current.user.email}</dd>
        </div>
      </dl>
      <Alert tone="info">Workspace tools for this account type are not available in this build yet.</Alert>
      {current.contexts.length > 1 && (
        <Button
          variant="secondary"
          onClick={() => navigate(CHOOSE_WORKSPACE)}
          trailingIcon={<ArrowLeftRight size={18} aria-hidden="true" />}
          className="workspace-switch"
        >
          Switch workspace
        </Button>
      )}
      <Button
        variant="secondary"
        onClick={signOut}
        loading={signingOut}
        loadingLabel="Signing out…"
        trailingIcon={<LogOut size={18} aria-hidden="true" />}
        className="workspace-signout"
      >
        Sign out
      </Button>
    </>
  )
}
