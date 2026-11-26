import { request } from './client'

export type AccountTypeId = 'organization' | 'venue' | 'club' | 'individual'
export type OrganizationKind = 'organizer' | 'venue' | 'club'

/**
 * A workspace the signed-in person may act in: one of their organization
 * memberships, or their personal Individual workspace. Resolved by the server
 * from verified memberships; the client only ever chooses among these.
 */
export interface WorkspaceContext {
  /** "individual", or the organization's ID. */
  id: string
  account_type: AccountTypeId
  organization: { id: string; name: string; kind: OrganizationKind } | null
  /** Role code from the server's catalogue, e.g. venue_manager. */
  role: string | null
  /** The role's display name, e.g. "Venue manager". */
  role_name: string | null
}

/** active: a context is chosen; selection_required: the user picks one; no_access: there is none. */
export type ContextStatus = 'active' | 'selection_required' | 'no_access'

export type Session =
  | { authenticated: false }
  | {
      authenticated: true
      user: { id: string; email: string; full_name: string }
      context: WorkspaceContext | null
      contexts: WorkspaceContext[]
      context_status: ContextStatus
      /** The previous context stopped being valid (membership or organization ended). */
      context_ended: boolean
      /** What the active workspace's role may do (permission codes, e.g. activity.view). */
      permissions: string[]
    }

export type SignedInSession = Extract<Session, { authenticated: true }>

/** Sign-in result: whether the chosen tile matched one of the account's workspaces (null without a tile). */
export type LoginResult = SignedInSession & { preference_matched: boolean | null }

export interface AuthConfig {
  account_types: { id: AccountTypeId; label: string }[]
  providers: { id: ProviderId; name: string; enabled: boolean }[]
  passkeys_enabled: boolean
  session_remember_days: number
}

export type ProviderId = 'google' | 'microsoft' | 'apple' | 'sso'

export interface LoginInput {
  email: string
  password: string
  /** The sign-in tile: a preference among the account's workspaces, never a grant. */
  account_type?: AccountTypeId
  remember: boolean
}

export interface InvitationPreview {
  organization: { name: string; kind: OrganizationKind }
  account_type: AccountTypeId
  role: string
  role_name: string
  /** The invited address, partly masked. */
  email: string
  expires_at: string
  state: 'pending' | 'expired' | 'accepted'
}

const BASE = '/api/v1/auth'
const ME = '/api/v1/me'
const INVITATIONS = '/api/v1/invitations'

export const authApi = {
  config: () => request<AuthConfig>('GET', `${BASE}/config/`),
  session: () => request<Session>('GET', `${BASE}/session/`),
  login: (input: LoginInput) => request<LoginResult>('POST', `${BASE}/login/`, input),
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
  /** Re-verified by the server against current memberships; rotates the session. */
  switchContext: (contextId: string) => request<SignedInSession>('PUT', `${ME}/context/`, { context: contextId }),
  previewInvitation: (token: string) => request<InvitationPreview>('POST', `${INVITATIONS}/preview/`, { token }),
  acceptInvitation: (token: string) => request<SignedInSession>('POST', `${INVITATIONS}/accept/`, { token }),
}
