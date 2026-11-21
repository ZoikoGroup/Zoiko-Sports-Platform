import { emptyOverview } from '../api/empty'
import { NotConnectedNotice, ResourceView } from '../components/DataState'
import { useDocumentTitle, useOrganizerShell } from '../shellContext'
import { CompetitionActivity } from './CompetitionActivity'
import { GlobalParticipation } from './GlobalParticipation'
import { HeroBanner, OverviewHeroActions } from './HeroBanner'
import { KpiCards } from './KpiCards'
import { OperationalAlerts } from './OperationalAlerts'
import { QuickActions } from './QuickActions'
import { RecentUpdates } from './RecentUpdates'
import { TasksApprovals } from './TasksApprovals'
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
      <div className="org-overview__row org-overview__row--main">
        {[0, 1, 2].map((i) => (
          <div key={i} className="org-skeleton org-skeleton--card" />
        ))}
      </div>
      <div className="org-overview__row org-overview__row--ops">
        {[0, 1, 2].map((i) => (
          <div key={i} className="org-skeleton org-skeleton--card-sm" />
        ))}
      </div>
    </div>
  )
}

/** Overview — the Organizer landing page after sign-in. */
export function OverviewPage() {
  const { overview, region, setRegion } = useOrganizerShell()
  useDocumentTitle('Overview')

  return (
    <ResourceView resource={overview} skeleton={<OverviewSkeleton />} errorTitle="We couldn't load your overview" empty={emptyOverview}>
      {(data) => {
        const now = new Date(data.generatedAt)
        return (
          <div className="org-overview" data-testid="organizer-overview">
            <HeroBanner title="Global Competition Operations" subtitle="Plan, manage and deliver world-class sporting events across markets.">
              <OverviewHeroActions />
            </HeroBanner>
            <NotConnectedNotice />
            <KpiCards kpis={data.kpis} />
            <div className="org-overview__row org-overview__row--main">
              <UpcomingEvents events={data.upcomingEvents} generatedAt={data.generatedAt} region={region} onRegionChange={setRegion} />
              <CompetitionActivity activity={data.activity} />
              <GlobalParticipation participation={data.participation} region={region} />
            </div>
            <div className="org-overview__row org-overview__row--ops">
              <OperationalAlerts alerts={data.alerts} now={now} />
              <TasksApprovals totalPending={data.tasks.totalPending} items={data.tasks.items} />
              <QuickActions />
            </div>
            <RecentUpdates items={data.recentUpdates} now={now} />
          </div>
        )
      }}
    </ResourceView>
  )
}
