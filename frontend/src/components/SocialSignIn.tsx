import { Building2, ChevronRight, Fingerprint } from 'lucide-react'
import type { ReactNode } from 'react'
import type { AuthConfig, ProviderId } from '../api/auth'
import { AppleMark, GoogleMark, MicrosoftMark } from './icons'
import './SocialSignIn.css'

const PROVIDERS: { id: ProviderId; name: string; mark: ReactNode }[] = [
  { id: 'google', name: 'Google', mark: <GoogleMark /> },
  { id: 'microsoft', name: 'Microsoft', mark: <MicrosoftMark /> },
  { id: 'apple', name: 'Apple', mark: <AppleMark /> },
  { id: 'sso', name: 'Company SSO', mark: <Building2 size={22} aria-hidden="true" /> },
]

interface SocialSignInProps {
  config: AuthConfig | null
  onProvider: (provider: ProviderId, name: string) => void
  onPasskey: () => void
  disabled?: boolean
}

/**
 * Federated and passkey sign-in. Methods that are not configured in this
 * environment stay visible but are labelled "Not yet available", and selecting
 * one explains that instead of pretending to start a sign-in.
 */
export function SocialSignIn({ config, onProvider, onPasskey, disabled }: SocialSignInProps) {
  const enabled = (id: ProviderId) => config?.providers.find((p) => p.id === id)?.enabled ?? false

  return (
    <div className="social">
      <p className="social__divider">
        <span>or continue with</span>
      </p>
      <ul className="social__providers">
        {PROVIDERS.map(({ id, name, mark }) => {
          const available = enabled(id)
          return (
            <li key={id}>
              <button
                type="button"
                className="social__provider"
                data-available={available}
                onClick={() => onProvider(id, name)}
                disabled={disabled}
                aria-label={available ? `Continue with ${name}` : `${name} sign-in — not yet available`}
              >
                <span className="social__mark">{mark}</span>
                <span>{name}</span>
              </button>
            </li>
          )
        })}
      </ul>
      <button
        type="button"
        className="social__passkey"
        data-available={config?.passkeys_enabled ?? false}
        onClick={onPasskey}
        disabled={disabled}
      >
        <span className="social__passkey-icon">
          <Fingerprint size={24} aria-hidden="true" />
        </span>
        <span className="social__passkey-text">
          <strong className="social__passkey-title">
            <span>Use a passkey</span>
            {!config?.passkeys_enabled && <span className="social__badge">Not yet available</span>}
          </strong>
          <span>Sign in securely with your device</span>
        </span>
        <ChevronRight size={22} aria-hidden="true" />
      </button>
    </div>
  )
}
