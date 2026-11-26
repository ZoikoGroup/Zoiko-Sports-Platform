import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  authApi,
  type AccountTypeId,
  type AuthConfig,
  type LoginInput,
  type LoginResult,
  type Session,
  type SignedInSession,
} from '../api/auth'

interface AuthState {
  /** null while the initial session check is in flight. */
  session: Session | null
  config: AuthConfig | null
  /** Signs in and resolves with the new session (used to pick the landing page). */
  login: (input: LoginInput) => Promise<LoginResult>
  logout: () => Promise<void>
  /** Switches the active workspace context; the server re-verifies it. */
  switchContext: (contextId: string) => Promise<SignedInSession>
  /** Accepts an emailed invitation and enters the organization's workspace. */
  acceptInvitation: (token: string) => Promise<SignedInSession>
  /** Re-reads the session, e.g. after the server reported that the context ended. */
  refresh: () => Promise<void>
  /** The sign-in tile, when it matched none of the account's workspaces (shown once, then cleared). */
  unmatchedTile: AccountTypeId | null
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [config, setConfig] = useState<AuthConfig | null>(null)
  const [unmatchedTile, setUnmatchedTile] = useState<AccountTypeId | null>(null)

  const refresh = useCallback(async () => {
    setSession(await authApi.session().catch((): Session => ({ authenticated: false })))
  }, [])

  useEffect(() => {
    authApi
      .session()
      .then(setSession)
      .catch(() => setSession({ authenticated: false }))
    authApi
      .config()
      .then(setConfig)
      .catch(() => setConfig(null))
  }, [])

  const login = useCallback(async (input: LoginInput) => {
    const signedIn = await authApi.login(input)
    setUnmatchedTile(signedIn.preference_matched === false ? (input.account_type ?? null) : null)
    setSession(signedIn)
    return signedIn
  }, [])

  const logout = useCallback(async () => {
    setUnmatchedTile(null)
    setSession(await authApi.logout())
  }, [])

  const switchContext = useCallback(async (contextId: string) => {
    const next = await authApi.switchContext(contextId)
    setUnmatchedTile(null)
    setSession(next)
    return next
  }, [])

  const acceptInvitation = useCallback(async (token: string) => {
    const next = await authApi.acceptInvitation(token)
    setSession(next)
    return next
  }, [])

  const value = useMemo(
    () => ({ session, config, login, logout, switchContext, acceptInvitation, refresh, unmatchedTile }),
    [session, config, login, logout, switchContext, acceptInvitation, refresh, unmatchedTile],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react/only-export-components
export function useAuth(): AuthState {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>')
  return context
}
