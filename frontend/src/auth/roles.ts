import type { Session, SignedInSession, WorkspaceContext } from '../api/auth'
import { accountTypeLabel } from './accountTypes'

/** Landing page of the Organizer Workspace. */
export const ORGANIZER_HOME = '/organizer/overview'
/** Where a signed-in person without an active workspace picks one (or learns they have none). */
export const CHOOSE_WORKSPACE = '/choose-workspace'

/**
 * Acting for an organizer organization. The server resolves the context from a
 * verified membership; this check only keeps the client from showing organizer
 * screens on another context. (UI routing only: data endpoints enforce access.)
 */
export const isOrganizer = (session: SignedInSession) =>
  session.context?.account_type === 'organization' && session.context.organization?.kind === 'organizer'

/** Where a signed-in user lands: organizers get their dashboard, others the workspace page. */
export function homePathFor(session: Session): string {
  if (!session.authenticated) return '/login'
  if (!session.context) return CHOOSE_WORKSPACE
  return isOrganizer(session) ? ORGANIZER_HOME : '/workspace'
}

/** "Organizer · Riverside Invitational", "Individual". */
export function contextLabel(context: WorkspaceContext): string {
  const workspace = context.account_type === 'organization' ? 'Organizer' : accountTypeLabel(context.account_type)
  return context.organization ? `${workspace} · ${context.organization.name}` : workspace
}

export const humanizeRole = (role: string | null) =>
  role ? role.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) : ''
