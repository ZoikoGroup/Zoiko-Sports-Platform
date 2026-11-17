import { useEffect } from 'react'
import { useOutletContext } from 'react-router-dom'
import type { RegionId } from './api/types'
import type { useOrganizerOverview } from './api/useOrganizerOverview'

/** Shared by the shell (sidebar, top bar) and the pages rendered inside it. */
export interface OrganizerShell {
  overview: ReturnType<typeof useOrganizerOverview>
  /** Region scope chosen in the top bar; the overview filters honour it. */
  region: RegionId | 'all'
  setRegion: (region: RegionId | 'all') => void
}

export const useOrganizerShell = () => useOutletContext<OrganizerShell>()

/** "Overview · Organizer · Zoiko Sports" in the browser tab. */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · Organizer · Zoiko Sports`
  }, [title])
}
