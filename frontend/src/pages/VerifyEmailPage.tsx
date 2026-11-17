import { ArrowRight, LoaderCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { authApi } from '../api/auth'
import { ApiError } from '../api/client'
import { CardHeader } from '../components/CardHeader'
import { Alert } from '../components/form/Alert'
import './pages.css'

type Status = 'verifying' | 'verified' | 'failed'

export function VerifyEmailPage() {
  const [params] = useSearchParams()
  const [status, setStatus] = useState<Status>('verifying')
  const [message, setMessage] = useState('')
  const started = useRef(false)

  useEffect(() => {
    // Tokens are single-use: guard against StrictMode's double effect run.
    if (started.current) return
    started.current = true
    authApi
      .verifyEmail(params.get('uid') ?? '', params.get('token') ?? '')
      .then(() => setStatus('verified'))
      .catch((error) => {
        setStatus('failed')
        setMessage(error instanceof ApiError ? error.message : 'We could not verify your email. Please try again.')
      })
  }, [params])

  return (
    <>
      <CardHeader title={status === 'verified' ? 'Email verified' : 'Verify your email'} />
      {status === 'verifying' && (
        <Alert tone="info">
          <span className="verify-progress">
            <LoaderCircle size={18} className="btn__spinner" aria-hidden="true" /> Verifying your email…
          </span>
        </Alert>
      )}
      {status === 'verified' && <Alert tone="success">Your account is active. You can now sign in.</Alert>}
      {status === 'failed' && <Alert tone="error">{message}</Alert>}
      <p className="auth-form__aside">
        <Link to="/login">
          Go to sign in <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </p>
    </>
  )
}
