/**
 * Backend operations behind every Organizer screen and action.
 *
 * An entry is filled in when its backend phase delivers it (backend/docs/roadmap).
 * Until then it is `null`: the matching screen shows its "not connected" state and
 * the action reports that it is not available; nothing is simulated in the browser.
 *
 * Connected: Venues & Readiness (backend P12.1, decision D-047).
 *
 * To connect a screen: set its entry, and if the agreed response differs from
 * the view model in types.ts, map it in organizerApi.ts.
 */
import type { Operation, OperationFor } from '../../../api/resource'

interface OrganizerEndpoints {
  // Reads, one per screen.
  overview: Operation | null
  actionCenter: Operation | null
  competitions: Operation | null
  fixtures: Operation | null
  venues: Operation | null
  // Competitions & Events actions.
  createCompetition: Operation | null
  createEvent: OperationFor<[competitionId: string]> | null
  // Fixtures & Schedule actions.
  createFixture: Operation | null
  proposeFixtureChange: OperationFor<[fixtureId: string]> | null
  requestFixtureApproval: OperationFor<[fixtureId: string]> | null
  publishFixtureChange: OperationFor<[fixtureId: string]> | null
  discardFixtureChange: OperationFor<[fixtureId: string]> | null
  // Venues & Readiness actions (venue readiness module, backend P12.1).
  requestReadinessUpdate: OperationFor<[readinessId: string]> | null
}

export const ORGANIZER_ENDPOINTS: OrganizerEndpoints = {
  overview: null,
  actionCenter: null,
  competitions: null,
  fixtures: null,
  venues: { method: 'GET', path: '/api/v1/organizer/venues/' },
  createCompetition: null,
  createEvent: null,
  createFixture: null,
  proposeFixtureChange: null,
  requestFixtureApproval: null,
  publishFixtureChange: null,
  discardFixtureChange: null,
  requestReadinessUpdate: (readinessId) => ({
    method: 'POST',
    path: `/api/v1/venue-readiness/${encodeURIComponent(readinessId)}/update-requests/`,
  }),
}
