/**
 * Backend operations behind every Organizer screen and action.
 *
 * None is defined yet: methods and paths come from the API specification
 * (ZS-API-001), which has not been agreed. Until an entry is filled in, the
 * matching screen shows its "not connected" state and the action reports that
 * it is not available; nothing is simulated in the browser.
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
  // Competitions & Events actions.
  createCompetition: Operation | null
  createEvent: OperationFor<[competitionId: string]> | null
  // Fixtures & Schedule actions.
  createFixture: Operation | null
  proposeFixtureChange: OperationFor<[fixtureId: string]> | null
  requestFixtureApproval: OperationFor<[fixtureId: string]> | null
  publishFixtureChange: OperationFor<[fixtureId: string]> | null
  discardFixtureChange: OperationFor<[fixtureId: string]> | null
}

export const ORGANIZER_ENDPOINTS: OrganizerEndpoints = {
  overview: null,
  actionCenter: null,
  competitions: null,
  fixtures: null,
  createCompetition: null,
  createEvent: null,
  createFixture: null,
  proposeFixtureChange: null,
  requestFixtureApproval: null,
  publishFixtureChange: null,
  discardFixtureChange: null,
}
