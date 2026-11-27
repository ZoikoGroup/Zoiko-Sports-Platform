/**
 * Thin fetch wrapper for the Django API.
 *
 * Every error comes back in the backend envelope {"error": {code, message, fields?}}
 * and is surfaced as an ApiError. Unsafe requests echo the csrftoken cookie in
 * X-CSRFToken; the cookie is re-read on each call because Django rotates it on
 * sign-in.
 */

export type FieldErrors = Record<string, string[]>

export class ApiError extends Error {
  readonly code: string
  readonly status: number
  readonly fields: FieldErrors
  readonly details: Record<string, unknown>

  constructor(code: string, message: string, status: number, details: Record<string, unknown> = {}) {
    super(message)
    this.code = code
    this.status = status
    this.details = details
    this.fields = (details.fields as FieldErrors | undefined) ?? {}
  }
}

const NETWORK_ERROR = new ApiError(
  'network_error',
  "We couldn't reach Zoiko Sports. Check your connection and try again.",
  0,
)

function readCookie(name: string): string | null {
  const match = document.cookie.split('; ').find((row) => row.startsWith(`${name}=`))
  return match ? decodeURIComponent(match.split('=')[1]) : null
}

// One shared bootstrap: parallel first requests must not each fetch a token.
let csrfBootstrap: Promise<void> | null = null

async function ensureCsrfToken(): Promise<string> {
  const existing = readCookie('csrftoken')
  if (existing) return existing
  csrfBootstrap ??= request('GET', '/api/v1/auth/csrf/')
    .then(() => undefined)
    .finally(() => {
      csrfBootstrap = null
    })
  await csrfBootstrap
  return readCookie('csrftoken') ?? ''
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

/**
 * A fresh Idempotency-Key for one submission of a create (backend D-014): a retry of
 * the same submission reuses it, a new submission gets a new one. crypto.randomUUID
 * needs a secure context, so plain-HTTP hosts fall back to the same v4 layout.
 */
export function newIdempotencyKey(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export interface RequestOptions {
  /** Cancels the request (e.g. when the page that asked for it unmounts). */
  signal?: AbortSignal
  /** Extra headers, such as concurrency or idempotency headers once the API defines them. */
  headers?: Record<string, string>
}

export async function request<T>(method: HttpMethod, path: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
  try {
    return await send<T>(method, path, body, options)
  } catch (error) {
    // On a first visit, two responses arriving together (e.g. the session check and
    // a CSRF bootstrap) can each set a different csrftoken cookie, so a request sent
    // in between carries a stale token. The server rejects it before doing anything,
    // so one retry with the cookie as it is now is safe.
    if (method !== 'GET' && error instanceof ApiError && error.code === 'csrf_failed') {
      return send<T>(method, path, body, options)
    }
    throw error
  }
}

async function send<T>(method: HttpMethod, path: string, body: unknown, options: RequestOptions): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json', ...options.headers }
  if (method !== 'GET') {
    headers['Content-Type'] = 'application/json'
    headers['X-CSRFToken'] = await ensureCsrfToken()
  }

  let response: Response
  try {
    response = await fetch(path, {
      method,
      headers,
      credentials: 'same-origin',
      signal: options.signal,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (error) {
    // A cancelled request is not a network failure; let the caller ignore it.
    if (options.signal?.aborted) throw error
    throw NETWORK_ERROR
  }

  const payload = await response.json().catch(() => null)
  if (response.ok) return payload as T

  const error = payload?.error
  if (error?.code) {
    const { code, message, ...details } = error
    throw new ApiError(code, message, response.status, details)
  }
  throw new ApiError('server_error', 'Something went wrong on our side. Please try again.', response.status)
}
