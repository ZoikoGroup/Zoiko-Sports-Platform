import { useCallback } from 'react'
import { authApi } from '../api/auth'
import { homePathFor } from './roles'

/**
 * Switches the active workspace without signing out. The server re-verifies the
 * membership and rotates the session; the page then loads afresh at the new
 * workspace's home, so no data, cache or pending request of the previous
 * workspace survives the switch.
 */
export function useSwitchWorkspace() {
  return useCallback(async (contextId: string) => {
    const next = await authApi.switchContext(contextId)
    window.location.assign(homePathFor(next))
  }, [])
}
