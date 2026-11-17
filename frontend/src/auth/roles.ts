import type { Session, SignedInSession } from '../api/auth'

/** Landing page of the Organizer Workspace. */
export const ORGANIZER_HOME = '/organizer/overview'

/** The organization membership the session is scoped to, if any. */
export const activeMembership = (session: SignedInSession) =>
  session.memberships.find((m) => m.organization_id === session.active_organization_id)

/**
 * Signed in to the Organization workspace through an organizer membership.
 * The server grants that workspace only with such a membership; checking both
 * keeps the client from showing organizer screens on an unexpected session.
 * (UI routing only — data endpoints must enforce access on the server.)
 */
export const isOrganizer = (session: SignedInSession) =>
  session.account_type === 'organization' && activeMembership(session)?.organization_kind === 'organizer'

/** Where a signed-in user lands: organizers get their dashboard, others the workspace page. */
export function homePathFor(session: Session): string {
  if (!session.authenticated) return '/login'
  return isOrganizer(session) ? ORGANIZER_HOME : '/workspace'
}
