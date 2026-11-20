import { useResource } from '../../../api/resource'
import { organizerApi } from './organizerApi'

/** The Overview data (also feeds the shell's badges and notifications). */
export const useOrganizerOverview = () =>
  useResource(organizerApi.overview, "We couldn't load your overview. Please try again.")

/** The Action Center data. */
export const useActionCenter = () =>
  useResource(organizerApi.actionCenter, "We couldn't load the Action Center. Please try again.")

/** Competitions & Events data. */
export const useCompetitions = () =>
  useResource(organizerApi.competitions, "We couldn't load your competitions. Please try again.")

/** Fixtures & Schedule data. */
export const useFixtures = () =>
  useResource(organizerApi.fixtures, "We couldn't load your fixtures. Please try again.")
