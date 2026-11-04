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

async function ensureCsrfToken(): Promise<string> {
  const existing = readCookie('csrftoken')
  if (existing) return existing
  await request('GET', '/api/v1/auth/csrf/')
  return readCookie('csrftoken') ?? ''
}

export async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
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
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
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
