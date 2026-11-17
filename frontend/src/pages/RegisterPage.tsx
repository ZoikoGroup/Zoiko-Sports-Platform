import { ArrowLeft, ArrowRight, Mail, User } from 'lucide-react'
import { useState, type SubmitEvent } from 'react'
import { Link } from 'react-router-dom'
import { authApi } from '../api/auth'
import { CardHeader } from '../components/CardHeader'
import { Alert } from '../components/form/Alert'
import { Button } from '../components/form/Button'
import { PasswordField, TextField } from '../components/form/TextField'
import { EMAIL_PATTERN, useFormFeedback } from './useFormFeedback'
import './pages.css'

export function RegisterPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const { feedback, setFeedback, fieldError, setFieldErrors, alertRef, reset, showError } = useFormFeedback()

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    reset()

    const errors: Record<string, string[]> = {}
    if (!fullName.trim()) errors.full_name = ['Enter your full name.']
    if (!EMAIL_PATTERN.test(email.trim())) errors.email = ['Enter a valid email address.']
    if (password.length < 10) errors.password = ['Use at least 10 characters.']
    if (Object.keys(errors).length) {
      setFieldErrors(errors)
      setFeedback({ tone: 'error', message: 'Please correct the highlighted fields.' })
      return
    }

    setSubmitting(true)
    try {
      await authApi.register({ full_name: fullName.trim(), email: email.trim(), password })
      setSentTo(email.trim())
    } catch (error) {
      showError(error)
    } finally {
      setSubmitting(false)
    }
  }

  if (sentTo) {
    return (
      <>
        <CardHeader title="Check your email" documentTitle="Create account" />
        <Alert tone="success">
          <span>
            We've sent a verification link to <strong>{sentTo}</strong>. Open it to activate your account, then sign in.
          </span>
        </Alert>
        <p className="auth-form__aside">
          <Link to="/login">
            <ArrowLeft size={18} aria-hidden="true" /> Back to sign in
          </Link>
        </p>
      </>
    )
  }

  return (
    <>
      <CardHeader title="Create your account" subtitle="Start with a personal Zoiko Sports account." />

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {feedback && (
          <Alert ref={alertRef} tone={feedback.tone}>
            {feedback.message}
          </Alert>
        )}

        <TextField
          label="Full name"
          name="full_name"
          autoComplete="name"
          icon={<User size={20} />}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          error={fieldError('full_name')}
          required
        />
        <TextField
          label="Email address"
          name="email"
          type="email"
          autoComplete="email"
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
          autoComplete="new-password"
          hint="At least 10 characters. Avoid common words and personal details."
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldError('password')}
          required
        />

        <p className="auth-form__note">
          Organization, venue and club workspaces are added when an administrator of that organization invites you.
        </p>

        <Button
          type="submit"
          className="auth-form__submit"
          loading={submitting}
          loadingLabel="Creating account…"
          trailingIcon={<ArrowRight size={22} aria-hidden="true" />}
        >
          Create account
        </Button>
      </form>

      <p className="auth-form__aside">
        Already have an account?
        <Link to="/login">
          Sign in <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </p>
    </>
  )
}
