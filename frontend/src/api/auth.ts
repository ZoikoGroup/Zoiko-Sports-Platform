import { request } from './client'

export type AccountTypeId = 'organization' | 'venue' | 'club' | 'individual'

interface Membership {
  organization_id: number
  organization_name: string
  organization_kind: 'organizer' | 'venue' | 'club'
  role: string
}

export type Session =
  | { authenticated: false }
  | {
      authenticated: true
      user: { id: number; email: string; full_name: string }
      account_type: AccountTypeId
      active_organization_id: number | null
      available_account_types: AccountTypeId[]
      memberships: Membership[]
    }

export type SignedInSession = Extract<Session, { authenticated: true }>

export interface AuthConfig {
  account_types: { id: AccountTypeId; label: string }[]
  providers: { id: ProviderId; name: string; enabled: boolean }[]
  passkeys_enabled: boolean
}

export type ProviderId = 'google' | 'microsoft' | 'apple' | 'sso'

export interface LoginInput {
  email: string
  password: string
  account_type: AccountTypeId
  remember: boolean
}

const BASE = '/api/v1/auth'

export const authApi = {
  config: () => request<AuthConfig>('GET', `${BASE}/config/`),
  session: () => request<Session>('GET', `${BASE}/session/`),
  login: (input: LoginInput) => request<SignedInSession>('POST', `${BASE}/login/`, input),
  logout: () => request<Session>('POST', `${BASE}/logout/`, {}),
  register: (input: { full_name: string; email: string; password: string }) =>
    request<{ status: string }>('POST', `${BASE}/register/`, input),
  verifyEmail: (uid: string, token: string) =>
    request<{ status: string }>('POST', `${BASE}/verify-email/`, { uid, token }),
  resendVerification: (email: string) =>
    request<{ status: string }>('POST', `${BASE}/verify-email/resend/`, { email }),
  requestPasswordReset: (email: string) =>
    request<{ status: string }>('POST', `${BASE}/password-reset/`, { email }),
  confirmPasswordReset: (uid: string, token: string, new_password: string) =>
    request<{ status: string }>('POST', `${BASE}/password-reset/confirm/`, { uid, token, new_password }),
  startProvider: (provider: ProviderId) =>
    request<{ redirect_url: string }>('POST', `${BASE}/providers/${provider}/start/`, {}),
}
