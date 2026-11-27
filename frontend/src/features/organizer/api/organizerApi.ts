import { newIdempotencyKey } from '../../../api/client'
import { call, type OperationFor } from '../../../api/resource'
import { ORGANIZER_ENDPOINTS as API } from './endpoints'
import { toVenuesData, type VenuesResponse } from './venuesMapping'
import type {
  ActionCenterData,
  CompetitionsData,
  FixtureChangeInput,
  FixturesData,
  NewCompetition,
  NewCompetitionEvent,
  NewFixture,
  OrganizerOverview,
  PublishInput,
  VenuesData,
} from './types'

/**
 * Organizer data access. Screens only talk to this module.
 *
 * Each method runs its operation from endpoints.ts. While an operation is not
 * defined, the call rejects with NotConnectedError: reads render their "not
 * connected" state, actions show that they are not available. Responses are
 * expected in the view-model shapes of types.ts; if the agreed API differs,
 * map the response here so that no component changes.
 *
 * Actions resolve when the server has accepted them; screens then refresh
 * their data from the server instead of predicting the result locally.
 */
const at = <Args extends unknown[]>(operation: OperationFor<Args> | null, ...args: Args) => (operation ? operation(...args) : null)

export const organizerApi = {
  overview: (signal?: AbortSignal) => call<OrganizerOverview>(API.overview, undefined, { signal }),
  actionCenter: (signal?: AbortSignal) => call<ActionCenterData>(API.actionCenter, undefined, { signal }),
  competitions: (signal?: AbortSignal) => call<CompetitionsData>(API.competitions, undefined, { signal }),
  fixtures: (signal?: AbortSignal) => call<FixturesData>(API.fixtures, undefined, { signal }),
  venues: (signal?: AbortSignal): Promise<VenuesData> =>
    call<VenuesResponse>(API.venues, undefined, { signal }).then(toVenuesData),

  createCompetition: (input: NewCompetition) => call<unknown>(API.createCompetition, input),
  createEvent: ({ competitionId, ...input }: NewCompetitionEvent) => call<unknown>(at(API.createEvent, competitionId), input),

  createFixture: (input: NewFixture) => call<unknown>(API.createFixture, input),
  proposeFixtureChange: (fixtureId: string, input: FixtureChangeInput) =>
    call<unknown>(at(API.proposeFixtureChange, fixtureId), input),
  requestFixtureApproval: (fixtureId: string, version: number) =>
    call<unknown>(at(API.requestFixtureApproval, fixtureId), { version }),
  publishFixtureChange: (fixtureId: string, input: PublishInput) => call<unknown>(at(API.publishFixtureChange, fixtureId), input),
  discardFixtureChange: (fixtureId: string) => call<unknown>(at(API.discardFixtureChange, fixtureId)),

  /** Asks the venue to update its readiness (it appears in the venue's activity feed). One key per submission. */
  requestReadinessUpdate: (readinessId: string, message: string) =>
    call<unknown>(at(API.requestReadinessUpdate, readinessId), { message }, { headers: { 'Idempotency-Key': newIdempotencyKey() } }),
}
