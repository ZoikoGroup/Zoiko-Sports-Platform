import { ArrowRight, LoaderCircle, LogOut } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { authApi, type InvitationPreview } from '../api/auth'
import { ApiError } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { contextLabel, homePathFor } from '../auth/roles'
import { CardHeader } from '../components/CardHeader'
import { Alert } from '../components/form/Alert'
import { Button } from '../components/form/Button'
import './pages.css'

const STORAGE_KEY = 'zs.invitationToken'
export const INVITATION_PATH = '/invitations/accept'

/**
 * The emailed link carries the token in the URL fragment (#token=...), which
 * browsers never send to a server, so it stays out of access logs. The page
 * moves it into session storage and strips it from the address bar, so it
 * survives a detour through sign-in without lingering in history.
 */
function takeToken(hash: string): string {
  const fromHash = new URLSearchParams(hash.replace(/^#/, '')).get('token')
  try {
    if (fromHash) {
      sessionStorage.setItem(STORAGE_KEY, fromHash)
      window.history.replaceState(window.history.state, '', INVITATION_PATH)
      return fromHash
    }
    return sessionStorage.getItem(STORAGE_KEY) ?? ''
  } catch {
    return fromHash ?? ''
  }
}

function forgetToken() {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* storage unavailable */
  }
}

const workspaceName = (preview: InvitationPreview) =>
  contextLabel({ id: '', account_type: preview.account_type, role: null, role_name: null, organization: { id: '', ...preview.organization } })

export function InvitationPage() {
  const { session, acceptInvitation, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [token] = useState(() => takeToken(location.hash))
  const [preview, setPreview] = useState<InvitationPreview | null>(null)
  const [error, setError] = useState<string | null>(token ? null : "This invitation link isn't complete.")
  const [accepting, setAccepting] = useState(false)
  const started = useRef(false)

  useEffect(() => {
    if (!token || started.current) return
    started.current = true
    authApi
      .previewInvitation(token)
      .then(setPreview)
      .catch((failure) => setError(failure instanceof ApiError ? failure.message : "We couldn't open this invitation."))
  }, [token])

  async function accept() {
    setAccepting(true)
    setError(null)
    try {
      const next = await acceptInvitation(token)
      forgetToken()
      navigate(homePathFor(next), { replace: true })
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : 'Something went wrong. Please try again.')
      setAccepting(false)
    }
  }

  async function switchAccount() {
    await logout().catch(() => undefined)
    navigate('/login', { replace: true, state: { from: INVITATION_PATH } })
  }

  const signedIn = session?.authenticated === true
  const usable = preview?.state === 'pending'

  return (
    <>
      <CardHeader title="You're invited" documentTitle="Invitation" />

      {!preview && !error && (
        <Alert tone="info">
          <span className="verify-progress">
            <LoaderCircle size={18} className="btn__spinner" aria-hidden="true" /> Opening your invitation…
          </span>
        </Alert>
      )}

      {preview && (
        <dl className="workspace-summary" aria-label="Invitation">
          <div>
            <dt>Organization</dt>
            <dd data-testid="invitation-organization">{preview.organization.name}</dd>
          </div>
          <div>
            <dt>Workspace</dt>
            <dd>{workspaceName(preview)}</dd>
          </div>
          <div>
            <dt>Role</dt>
            <dd>{preview.role_name}</dd>
          </div>
          <div>
            <dt>Sent to</dt>
            <dd>{preview.email}</dd>
          </div>
        </dl>
      )}

      {preview?.state === 'expired' && (
        <Alert tone="error">This invitation has expired. Ask the organization to send you a new one.</Alert>
      )}
      {preview?.state === 'accepted' && <Alert tone="info">This invitation has already been used.</Alert>}
      {error && <Alert tone="error">{error}</Alert>}

      {usable && session !== null && !signedIn && (
        <>
          <p className="auth-form__note">Sign in with the address the invitation was sent to, then accept it here.</p>
          <div className="auth-form__actions">
            <Button type="button" onClick={() => navigate('/login', { state: { from: INVITATION_PATH } })}>
              Sign in to accept
            </Button>
          </div>
          <p className="auth-form__note">
            New to Zoiko Sports? <Link to="/register">Create an account</Link> with that address, verify it, then open
            the invitation link from your email again.
          </p>
        </>
      )}

      {usable && signedIn && (
        <>
          <Button
            onClick={accept}
            loading={accepting}
            loadingLabel="Accepting…"
            trailingIcon={<ArrowRight size={20} aria-hidden="true" />}
          >
            Accept invitation
          </Button>
          <Button
            variant="secondary"
            onClick={switchAccount}
            trailingIcon={<LogOut size={18} aria-hidden="true" />}
            className="workspace-signout"
          >
            Use a different account
          </Button>
        </>
      )}
    </>
  )
}
