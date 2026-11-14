import { CircleAlert, RefreshCw } from 'lucide-react'
import { useOrganizerShell, useDocumentTitle } from '../shellContext'
import { GlobalParticipation } from './GlobalParticipation'
import { HeroBanner } from './HeroBanner'
import { KpiCards } from './KpiCards'
import { QuickActions } from './QuickActions'
import { RecentDecisions } from './RecentDecisions'
import { UpcomingEvents } from './UpcomingEvents'

function OverviewSkeleton() {
  return (
    <div className="org-overview" aria-busy="true">
      <span role="status" className="visually-hidden">
        Loading your overview
      </span>
      <div className="org-skeleton org-skeleton--hero" />
      <div className="org-kpis">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="org-skeleton org-skeleton--kpi" />
        ))}
      </div>
      <div className="org-overview__grid">
        <div className="org-skeleton org-skeleton--card-lg" />
        <div className="org-overview__side">
          <div className="org-skeleton org-skeleton--card" />
          <div className="org-skeleton org-skeleton--card" />
        </div>
      </div>
    </div>
  )
}

/** 01. Overview — the Organizer landing page after sign-in. */
export function OverviewPage() {
  const { overview, region, setRegion } = useOrganizerShell()
  useDocumentTitle('Overview')

  if (overview.status === 'loading') return <OverviewSkeleton />
  if (overview.status === 'error') {
    return (
      <div className="org-overview">
        <div className="org-card org-error" role="alert">
          <CircleAlert size={28} aria-hidden="true" />
          <div>
            <h1 className="org-card__title">We couldn't load your overview</h1>
            <p>{overview.error}</p>
          </div>
          <button type="button" className="org-btn org-btn--secondary" onClick={overview.reload}>
            <RefreshCw size={18} aria-hidden="true" /> Try again
          </button>
        </div>
      </div>
    )
  }

  const data = overview.data
  return (
    <div className="org-overview" data-testid="organizer-overview">
      <HeroBanner title={data.hero.title} subtitle={data.hero.subtitle} />
      <KpiCards kpis={data.kpis} />
      <div className="org-overview__grid">
        <UpcomingEvents events={data.upcomingEvents} generatedAt={data.generatedAt} region={region} onRegionChange={setRegion} />
        <div className="org-overview__side">
          <GlobalParticipation shares={data.participation} region={region} />
          <RecentDecisions items={data.recentDecisions} now={new Date(data.generatedAt)} />
        </div>
      </div>
      <QuickActions />
    </div>
  )
}
