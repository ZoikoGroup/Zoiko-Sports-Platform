import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { authApi, type AuthConfig, type LoginInput, type Session } from '../api/auth'

interface AuthState {
  /** null while the initial session check is in flight. */
  session: Session | null
  config: AuthConfig | null
  login: (input: LoginInput) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [config, setConfig] = useState<AuthConfig | null>(null)

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
    setSession(await authApi.login(input))
  }, [])

  const logout = useCallback(async () => {
    setSession(await authApi.logout())
  }, [])

  const value = useMemo(() => ({ session, config, login, logout }), [session, config, login, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react/only-export-components
export function useAuth(): AuthState {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>')
  return context
}
