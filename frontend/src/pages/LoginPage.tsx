import { ArrowRight, Info, Mail } from 'lucide-react'
import { useState, type SubmitEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { authApi, type AccountTypeId, type ProviderId } from '../api/auth'
import { ApiError } from '../api/client'
import { rememberAccountType, rememberedAccountType } from '../auth/accountTypes'
import { useAuth } from '../auth/AuthContext'
import { homePathFor } from '../auth/roles'
import { AccountTypeSelector } from '../components/AccountTypeSelector'
import { CardHeader } from '../components/CardHeader'
import { Alert } from '../components/form/Alert'
import { Button } from '../components/form/Button'
import { Checkbox } from '../components/form/Checkbox'
import { PasswordField, TextField } from '../components/form/TextField'
import { SsoSignIn } from '../components/SsoSignIn'
import { EMAIL_PATTERN, useFormFeedback } from './useFormFeedback'
import './pages.css'

export function LoginPage() {
  const { login, config } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [accountType, setAccountType] = useState<AccountTypeId>(rememberedAccountType)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const { feedback, setFeedback, fieldError, setFieldErrors, alertRef, reset, showError } = useFormFeedback()

  const selectAccountType = (id: AccountTypeId) => {
    setAccountType(id)
    rememberAccountType(id)
  }

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    reset()

    const errors: Record<string, string[]> = {}
    if (!EMAIL_PATTERN.test(email.trim())) errors.email = ['Enter a valid email address.']
    if (!password) errors.password = ['Enter your password.']
    if (Object.keys(errors).length) {
      setFieldErrors(errors)
      setFeedback({ tone: 'error', message: 'Please correct the highlighted fields.' })
      return
    }

    setSubmitting(true)
    try {
      // The tile is a preference: the server enters the matching workspace, or
      // offers the account's workspaces to choose from. It never grants one.
      const session = await login({ email: email.trim(), password, account_type: accountType, remember })
      // A deep link wins; route guards send it on if this workspace can't open it.
      const from = (location.state as { from?: string } | null)?.from
      navigate(from ?? homePathFor(session), { replace: true })
    } catch (error) {
      showError(error)
      if (error instanceof ApiError && error.code === 'invalid_credentials') setPassword('')
    } finally {
      setSubmitting(false)
    }
  }

  async function resendVerification() {
    try {
      await authApi.resendVerification(email.trim())
      setFeedback({ tone: 'success', message: "If your account still needs verifying, we've sent a new link to your email." })
    } catch (error) {
      showError(error)
    }
  }

  async function startProvider(provider: ProviderId, name: string) {
    reset()
    try {
      const { redirect_url } = await authApi.startProvider(provider)
      window.location.assign(redirect_url)
    } catch (error) {
      const message = error instanceof ApiError ? error.message : `Sign-in with ${name} isn't available right now.`
      setFeedback({ tone: 'info', message })
    }
  }

  return (
    <>
      <CardHeader title="Welcome back" subtitle="Sign in to your Zoiko Sports account." documentTitle="Sign in" logo="mark" />

      <form className="auth-form auth-form--signin" onSubmit={handleSubmit} noValidate>
        <AccountTypeSelector value={accountType} onChange={selectAccountType} disabled={submitting} />

        {feedback && (
          <Alert ref={alertRef} tone={feedback.tone}>
            <span>{feedback.message}</span>
            {feedback.code === 'email_not_verified' && (
              <button type="button" className="link-button" onClick={resendVerification}>
                Resend verification email
              </button>
            )}
          </Alert>
        )}

        <TextField
          label="Email address"
          name="email"
          type="email"
          autoComplete="username"
          inputMode="email"
          placeholder="name@company.com"
          icon={<Mail size={20} />}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldError('email')}
          required
        />

        <PasswordField
          label="Password"
          name="password"
          autoComplete="current-password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldError('password')}
          required
        />

        <div className="auth-form__row">
          <span className="remember">
            <Checkbox label="Keep me signed in" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            <span className="toggletip">
              <button type="button" aria-label="About keep me signed in" aria-describedby="remember-tip">
                <Info size={17} aria-hidden="true" />
              </button>
              <span role="tooltip" id="remember-tip" className="toggletip__bubble">
                Stay signed in on this device for {config?.session_remember_days ?? 14} days. Leave unchecked on
                shared computers.
              </span>
            </span>
          </span>
          <Link to="/forgot-password">Forgot password?</Link>
        </div>

        <Button
          type="submit"
          className="auth-form__submit"
          loading={submitting}
          loadingLabel="Signing in…"
          trailingIcon={<ArrowRight size={22} aria-hidden="true" />}
        >
          Sign In
        </Button>
      </form>

      <div className="auth-form__social">
        <SsoSignIn config={config} onProvider={startProvider} disabled={submitting} />
      </div>

      <p className="auth-form__aside">
        New to Zoiko Sports?
        <Link to="/register">
          Create an account <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </p>
    </>
  )
}
