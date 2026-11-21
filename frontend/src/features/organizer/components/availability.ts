import { createContext, useContext } from 'react'

/** "live": the data came from the server. "unavailable": not connected, nothing to show. */
export type Availability = 'live' | 'unavailable'

/** Set by <ResourceView> for everything inside a page. */
export const AvailabilityContext = createContext<Availability>('live')

export const useAvailability = () => useContext(AvailabilityContext)

/** Figures computed in the browser from lists are only meaningful when the lists are live. */
export function useKnown<T>(value: T): T | null {
  return useAvailability() === 'live' ? value : null
}
