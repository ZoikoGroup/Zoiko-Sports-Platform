import { ArrowLeft, Mail } from 'lucide-react'
import { useState, type SubmitEvent } from 'react'
import { Link } from 'react-router-dom'
import { authApi } from '../api/auth'
import { CardHeader } from '../components/CardHeader'
import { Alert } from '../components/form/Alert'
import { Button } from '../components/form/Button'
import { TextField } from '../components/form/TextField'
import { EMAIL_PATTERN, useFormFeedback } from './useFormFeedback'
import './pages.css'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { feedback, setFeedback, fieldError, setFieldErrors, alertRef, reset, showError } = useFormFeedback()

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    reset()
    if (!EMAIL_PATTERN.test(email.trim())) {
      setFieldErrors({ email: ['Enter a valid email address.'] })
      setFeedback({ tone: 'error', message: 'Please correct the highlighted fields.' })
      return
    }

    setSubmitting(true)
    try {
      await authApi.requestPasswordReset(email.trim())
      setFeedback({
        tone: 'success',
        message: "If an account exists for that email, we've sent a link to reset your password. It can be used once.",
      })
    } catch (error) {
      showError(error)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <CardHeader title="Reset your password" subtitle="Enter your email and we'll send you a reset link." />

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {feedback && (
          <Alert ref={alertRef} tone={feedback.tone}>
            {feedback.message}
          </Alert>
        )}
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
        <Button type="submit" className="auth-form__submit" loading={submitting} loadingLabel="Sending…">
          Send reset link
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
