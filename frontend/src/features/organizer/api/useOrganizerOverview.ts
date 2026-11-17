import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '../../../api/client'
import { organizerApi } from './organizerApi'
import type { OrganizerOverview } from './types'

type State =
  | { status: 'loading'; data: null; error: null }
  | { status: 'ready'; data: OrganizerOverview; error: null }
  | { status: 'error'; data: null; error: string }

const LOADING: State = { status: 'loading', data: null, error: null }

/** Loads the overview once per mount; `reload` retries after an error. */
export function useOrganizerOverview() {
  const [state, setState] = useState<State>(LOADING)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    organizerApi
      .overview(controller.signal)
      .then((data) => setState({ status: 'ready', data, error: null }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        const message = error instanceof ApiError ? error.message : "We couldn't load your overview. Please try again."
        setState({ status: 'error', data: null, error: message })
      })
    return () => controller.abort()
  }, [attempt])

  const reload = useCallback(() => {
    setState(LOADING)
    setAttempt((n) => n + 1)
  }, [])

  return { ...state, reload }
}
