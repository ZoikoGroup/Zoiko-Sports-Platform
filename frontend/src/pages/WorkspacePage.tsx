import { LogOut } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { SignedInSession } from '../api/auth'
import { accountTypeLabel } from '../auth/accountTypes'
import { useAuth } from '../auth/AuthContext'
import { CardHeader } from '../components/CardHeader'
import { Alert } from '../components/form/Alert'
import { Button } from '../components/form/Button'
import './pages.css'

const humanize = (role: string) => role.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())

/** Signed-in landing: confirms which workspace the session is scoped to. */
export function WorkspacePage() {
  const { session, logout } = useAuth()
  const navigate = useNavigate()
  const [signingOut, setSigningOut] = useState(false)
  const current = session as SignedInSession
  const membership = current.memberships.find((m) => m.organization_id === current.active_organization_id)

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
      <dl className="workspace-summary" aria-label="Current session">
        <div>
          <dt>Workspace</dt>
          <dd data-testid="workspace-type">{accountTypeLabel(current.account_type)}</dd>
        </div>
        {membership && (
          <>
            <div>
              <dt>Organization</dt>
              <dd data-testid="workspace-organization">{membership.organization_name}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>{humanize(membership.role)}</dd>
            </div>
          </>
        )}
        <div>
          <dt>Signed in as</dt>
          <dd>{current.user.email}</dd>
        </div>
      </dl>
      <Alert tone="info">Workspace tools for this account type are not available in this build yet.</Alert>
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
