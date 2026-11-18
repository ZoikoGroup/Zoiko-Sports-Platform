import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '../../../api/client'

type State<T> =
  | { status: 'loading'; data: null; error: null }
  | { status: 'ready'; data: T; error: null }
  | { status: 'error'; data: null; error: string }

/**
 * Loads one organizer resource per mount; `reload` retries after an error.
 * `load` must be a stable function (e.g. a method of organizerApi).
 */
export function useResource<T>(load: (signal: AbortSignal) => Promise<T>, fallbackError: string) {
  const [state, setState] = useState<State<T>>({ status: 'loading', data: null, error: null })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
      .then((data) => setState({ status: 'ready', data, error: null }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setState({ status: 'error', data: null, error: error instanceof ApiError ? error.message : fallbackError })
      })
    return () => controller.abort()
  }, [load, fallbackError, attempt])

  const reload = useCallback(() => {
    setState({ status: 'loading', data: null, error: null })
    setAttempt((n) => n + 1)
  }, [])

  return { ...state, reload }
}
