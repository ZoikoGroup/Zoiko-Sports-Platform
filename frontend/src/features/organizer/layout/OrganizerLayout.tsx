import { LoaderCircle } from 'lucide-react'
import { Suspense, useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import type { RegionId } from '../api/types'
import { useOrganizerOverview } from '../api/useOrganizerOverview'
import type { OrganizerShell } from '../shellContext'
import '../organizer.css'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

/**
 * Organizer Workspace frame: sidebar + top bar around the routed page.
 * Below 1024px the sidebar becomes a drawer opened from the top bar.
 */
export function OrganizerLayout() {
  const overview = useOrganizerOverview()
  const [region, setRegion] = useState<RegionId | 'all'>('all')
  const [navOpen, setNavOpen] = useState(false)
  const shell: OrganizerShell = { overview, region, setRegion }

  // Links inside the drawer close it themselves; Escape closes it too.
  useEffect(() => {
    if (!navOpen) return
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && setNavOpen(false)
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [navOpen])

  return (
    <div className="org-shell" data-nav-open={navOpen}>
      <a className="org-skip" href="#org-main">
        Skip to content
      </a>
      <Sidebar
        open={navOpen}
        onNavigate={() => setNavOpen(false)}
        onClose={() => setNavOpen(false)}
        counts={{ actionCenter: overview.data?.actionCenter.open ?? null }}
      />
      <div className="org-scrim" aria-hidden="true" onClick={() => setNavOpen(false)} />
      <div className="org-column">
        <Topbar shell={shell} onOpenNavigation={() => setNavOpen(true)} />
        <main id="org-main" className="org-main" tabIndex={-1}>
          <Suspense
            fallback={
              <div className="org-loading" role="status">
                <LoaderCircle className="btn__spinner" size={28} aria-hidden="true" />
                <span className="visually-hidden">Loading</span>
              </div>
            }
          >
            <Outlet context={shell} />
          </Suspense>
        </main>
      </div>
    </div>
  )
}
