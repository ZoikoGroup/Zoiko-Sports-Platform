// Warms the throwaway backend before any test runs: the first request to a fresh
// Django dev server pays module imports and the first (deliberately slow) PBKDF2
// password check, which otherwise lands inside the first test's assertions.
const API = 'http://127.0.0.1:8010/api/v1/auth'

export default async function globalSetup() {
  const csrf = await fetch(`${API}/csrf/`)
  const cookie = csrf.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ')
  const token = /csrftoken=([^;]+)/.exec(cookie)?.[1] ?? ''
  const response = await fetch(`${API}/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': token, Cookie: cookie, Origin: 'http://127.0.0.1:8010' },
    body: JSON.stringify({
      email: 'individual@zoikosports.test',
      password: process.env.E2E_DEMO_PASSWORD,
      account_type: 'individual',
      remember: false,
    }),
  })
  if (!response.ok) throw new Error(`Backend warm-up sign-in failed: HTTP ${response.status} ${await response.text()}`)
}
