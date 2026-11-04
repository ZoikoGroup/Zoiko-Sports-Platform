import { User, Users, type LucideIcon } from 'lucide-react'
import type { ComponentType } from 'react'
import type { AccountTypeId } from '../api/auth'
import { GroupIcon, StadiumIcon } from '../components/icons'

interface AccountTypeOption {
  id: AccountTypeId
  label: string
  hint: string
  icon: LucideIcon | ComponentType<{ size?: number }>
}

/** The four sign-in workspaces, in the order shown on the login page. */
export const ACCOUNT_TYPES: AccountTypeOption[] = [
  { id: 'organization', label: 'Organization', hint: 'League / Event', icon: GroupIcon },
  { id: 'venue', label: 'Venue', hint: 'Stadium / Arena', icon: StadiumIcon },
  { id: 'club', label: 'Team / Club', hint: 'Sports Team', icon: Users },
  { id: 'individual', label: 'Individual', hint: 'Participant / Staff', icon: User },
]

export const accountTypeLabel = (id: AccountTypeId) => ACCOUNT_TYPES.find((t) => t.id === id)?.label ?? id

const STORAGE_KEY = 'zs.lastAccountType'

export function rememberedAccountType(): AccountTypeId {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (ACCOUNT_TYPES.some((t) => t.id === stored)) return stored as AccountTypeId
  } catch {
    /* storage unavailable */
  }
  return 'organization'
}

export function rememberAccountType(id: AccountTypeId) {
  try {
    localStorage.setItem(STORAGE_KEY, id)
  } catch {
    /* storage unavailable */
  }
}
