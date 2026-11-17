import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useState, type SubmitEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { authApi } from '../api/auth'
import { CardHeader } from '../components/CardHeader'
import { Alert } from '../components/form/Alert'
import { Button } from '../components/form/Button'
import { PasswordField } from '../components/form/TextField'
import { useFormFeedback } from './useFormFeedback'
import './pages.css'

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const uid = params.get('uid') ?? ''
  const token = params.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const { feedback, setFeedback, fieldError, setFieldErrors, alertRef, reset, showError } = useFormFeedback()

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    reset()
    const errors: Record<string, string[]> = {}
    if (password.length < 10) errors.new_password = ['Use at least 10 characters.']
    if (confirm !== password) errors.confirm = ['Passwords do not match.']
    if (Object.keys(errors).length) {
      setFieldErrors(errors)
      setFeedback({ tone: 'error', message: 'Please correct the highlighted fields.' })
      return
    }

    setSubmitting(true)
    try {
      await authApi.confirmPasswordReset(uid, token, password)
      setDone(true)
    } catch (error) {
      showError(error)
    } finally {
      setSubmitting(false)
    }
  }

  if (!uid || !token) {
    return (
      <>
        <CardHeader title="Reset link incomplete" />
        <Alert tone="error">This reset link is missing information. Request a new one.</Alert>
        <p className="auth-form__aside">
          <Link to="/forgot-password">
            Request a new link <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </p>
      </>
    )
  }

  if (done) {
    return (
      <>
        <CardHeader title="Password updated" />
        <Alert tone="success">Your password has been changed. Sign in with your new password.</Alert>
        <p className="auth-form__aside">
          <Link to="/login">
            Go to sign in <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </p>
      </>
    )
  }

  return (
    <>
      <CardHeader title="Choose a new password" subtitle="This link can be used once." />
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {feedback && (
          <Alert ref={alertRef} tone={feedback.tone}>
            <span>{feedback.message}</span>
            {feedback.code === 'invalid_link' && <Link to="/forgot-password">Request a new link</Link>}
          </Alert>
        )}
        <PasswordField
          label="New password"
          name="new_password"
          autoComplete="new-password"
          hint="At least 10 characters. Avoid common words and personal details."
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldError('new_password')}
          required
        />
        <PasswordField
          label="Confirm new password"
          name="confirm"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={fieldError('confirm')}
          required
        />
        <Button type="submit" className="auth-form__submit" loading={submitting} loadingLabel="Saving…">
          Update password
        </Button>
      </form>
      <p className="auth-form__aside">
        <Link to="/login">
          <ArrowLeft size={18} aria-hidden="true" /> Back to sign in
        </Link>
      </p>
    </>
  )
}
