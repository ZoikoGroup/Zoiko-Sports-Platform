import type { AccountTypeId } from '../api/auth'
import { ACCOUNT_TYPES } from '../auth/accountTypes'
import './AccountTypeSelector.css'

interface AccountTypeSelectorProps {
  value: AccountTypeId
  onChange: (value: AccountTypeId) => void
  disabled?: boolean
}

/** The four sign-in workspaces as a native radio group (arrow keys move between options). */
export function AccountTypeSelector({ value, onChange, disabled }: AccountTypeSelectorProps) {
  return (
    <fieldset className="account-types" disabled={disabled}>
      <legend className="visually-hidden">Account type</legend>
      {ACCOUNT_TYPES.map(({ id, label, hint, icon: Icon }) => (
        <label key={id} className="account-type">
          <input
            type="radio"
            name="account_type"
            value={id}
            checked={value === id}
            onChange={() => onChange(id)}
          />
          <span className="account-type__tile">
            <Icon size={30} aria-hidden="true" />
            <span className="account-type__label">{label}</span>
            <span className="account-type__hint">({hint})</span>
          </span>
        </label>
      ))}
    </fieldset>
  )
}
