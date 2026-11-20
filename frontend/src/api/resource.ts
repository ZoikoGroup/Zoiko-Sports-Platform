/**
 * Shared data-access building blocks for every workspace.
 *
 * Screens never call `fetch` themselves: a feature's service module (for
 * example features/organizer/api/organizerApi.ts) maps each screen need to an
 * operation in that feature's endpoint registry. Until the backend API
 * contract is agreed, registry entries are `null`, and the service reports
 * NotConnectedError instead of returning invented data.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, request, type HttpMethod, type RequestOptions } from './client'

/** One backend call: method and path. Decided by the API specification, not by the UI. */
export interface Operation {
  method: HttpMethod
  path: string
}

/** An operation addressed by resource id(s), e.g. one fixture. */
export type OperationFor<Args extends unknown[]> = (...args: Args) => Operation

/** Raised when a screen needs data or an action the backend does not provide yet. */
export class NotConnectedError extends Error {
  readonly code = 'not_connected'
  constructor(message = "This isn't available yet: Zoiko Sports isn't connected to its data service.") {
    super(message)
    this.name = 'NotConnectedError'
  }
}

/** Runs an operation, or reports that it does not exist yet. */
export function call<T>(operation: Operation | null, body?: unknown, options?: RequestOptions): Promise<T> {
  if (!operation) return Promise.reject(new NotConnectedError())
  return request<T>(operation.method, operation.path, body, options)
}

/** A message for the person using the screen, whatever went wrong. */
export function describeError(error: unknown, fallback: string): string {
  if (error instanceof NotConnectedError || error instanceof ApiError) return error.message
  return fallback
}

export type ResourceState<T> =
  | { status: 'loading'; data: null; error: null }
  | { status: 'ready'; data: T; error: null }
  /** The backend does not provide this data yet: show the layout with empty states, not an error. */
  | { status: 'unavailable'; data: null; error: null }
  | { status: 'error'; data: null; error: string }

/**
 * Loads one resource per mount.
 * - `reload` starts over (loading state), e.g. "Try again" after an error.
 * - `refresh` fetches again while keeping the current data on screen (after a
 *   successful change) and resolves with the new data, or null if it failed.
 * `load` must be a stable function (e.g. a method of a service object).
 */
export function useResource<T>(load: (signal: AbortSignal) => Promise<T>, fallbackError: string) {
  const [state, setState] = useState<ResourceState<T>>({ status: 'loading', data: null, error: null })
  const [attempt, setAttempt] = useState(0)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const settle = useCallback(
    (error: unknown) =>
      setState(
        error instanceof NotConnectedError
          ? { status: 'unavailable', data: null, error: null }
          : { status: 'error', data: null, error: describeError(error, fallbackError) },
      ),
    [fallbackError],
  )

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
      .then((data) => setState({ status: 'ready', data, error: null }))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) settle(error)
      })
    return () => controller.abort()
  }, [load, settle, attempt])

  const reload = useCallback(() => {
    setState({ status: 'loading', data: null, error: null })
    setAttempt((n) => n + 1)
  }, [])

  const refresh = useCallback(async (): Promise<T | null> => {
    try {
      const data = await load(new AbortController().signal)
      if (mounted.current) setState({ status: 'ready', data, error: null })
      return data
    } catch (error) {
      if (mounted.current) settle(error)
      return null
    }
  }, [load, settle])

  return { ...state, reload, refresh }
}

export type Resource<T> = ReturnType<typeof useResource<T>>
