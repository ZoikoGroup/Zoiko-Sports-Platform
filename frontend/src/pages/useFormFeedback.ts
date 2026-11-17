import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ApiError, type FieldErrors } from '../api/client'

interface Feedback {
  tone: 'error' | 'success' | 'info'
  message: ReactNode
  code?: string
}

/**
 * Form-level message + per-field errors. Moves focus to the message when a new
 * error appears so keyboard and screen-reader users land on it.
 */
export function useFormFeedback() {
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const alertRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (feedback?.tone === 'error') alertRef.current?.focus()
  }, [feedback])

  const reset = useCallback(() => {
    setFeedback(null)
    setFieldErrors({})
  }, [])

  const showError = useCallback((error: unknown) => {
    if (error instanceof ApiError) {
      setFieldErrors(error.fields)
      setFeedback({ tone: 'error', message: error.message, code: error.code })
    } else {
      setFeedback({ tone: 'error', message: 'Something went wrong. Please try again.' })
    }
  }, [])

  const fieldError = (name: string) => fieldErrors[name]?.[0]

  return { feedback, setFeedback, fieldErrors, setFieldErrors, fieldError, alertRef, reset, showError }
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
