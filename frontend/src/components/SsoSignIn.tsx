import { LockKeyhole } from 'lucide-react'
import { useId } from 'react'
import type { AuthConfig, ProviderId } from '../api/auth'
import './SsoSignIn.css'

interface SsoSignInProps {
  config: AuthConfig | null
  onProvider: (provider: ProviderId, name: string) => void
  disabled?: boolean
}

/**
 * Company single sign-on, below a dotted rule. When SSO is not configured in
 * this environment the button stays visible; choosing it explains that instead
 * of pretending to start a sign-in, and screen readers hear it up front.
 */
export function SsoSignIn({ config, onProvider, disabled }: SsoSignInProps) {
  const hintId = useId()
  const available = config?.providers.find((p) => p.id === 'sso')?.enabled ?? false

  return (
    <div className="sso">
      <div className="sso__divider" aria-hidden="true" />
      <button
        type="button"
        className="sso__button"
        onClick={() => onProvider('sso', 'Company SSO')}
        disabled={disabled}
        aria-describedby={available ? undefined : hintId}
      >
        <LockKeyhole aria-hidden="true" />
        Sign in with SSO
      </button>
      {!available && (
        <span id={hintId} className="visually-hidden">
          Not yet available
        </span>
      )}
    </div>
  )
}
