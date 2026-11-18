/**
 * Fixture scheduling rules (O-11): revisions are only ever added by publishing
 * an approved change; a change records the version it was proposed against, and
 * publication fails cleanly if that version is no longer the latest.
 * Pure functions — the page keeps the results in state until the API exists,
 * where the server must enforce the same rules.
 */
import type { Fixture, FixtureChange } from '../api/types'

export type FixtureStatus = 'confirmed' | 'pending' | 'conflict' | 'draft'

export const FIXTURE_STATUS_LABELS: Record<FixtureStatus, string> = {
  confirmed: 'Confirmed',
  pending: 'Pending',
  conflict: 'Conflict',
  draft: 'Draft',
}

export const publishedVersion = (f: Fixture) => f.revisions[0]?.version ?? 0

export function fixtureStatus(f: Fixture): FixtureStatus {
  if (f.conflict) return 'conflict'
  if (f.revisions.length === 0) return 'draft'
  if (f.change) return 'pending'
  return 'confirmed'
}

/** The time and place people currently see: the published version, or the draft of a new fixture. */
export function current(f: Fixture): { startsAt: string; venue: string } {
  const source = f.revisions[0] ?? f.change
  return { startsAt: source!.startsAt, venue: source!.venue }
}

/** Roles that may approve and publish a schedule change (event authority is checked server-side). */
const APPROVER_ROLES = ['competition_director', 'organization_admin', 'admin']
export const canApprove = (role: string) => APPROVER_ROLES.includes(role)

export class ScheduleError extends Error {}

export function proposeChange(f: Fixture, input: { startsAt: string; venue: string; reason: string }, author: string): Fixture {
  if (f.change) throw new ScheduleError('This fixture already has a change in progress. Publish or discard it first.')
  if (!input.reason.trim()) throw new ScheduleError('Give a reason for the change.')
  const base = publishedVersion(f)
  const change: FixtureChange = {
    version: base + 1,
    baseVersion: base,
    startsAt: input.startsAt,
    venue: input.venue,
    reason: input.reason.trim(),
    author,
    proposedAt: new Date().toISOString(),
    state: 'proposed',
  }
  return { ...f, change }
}

export function requestApproval(f: Fixture): Fixture {
  if (!f.change || f.change.state !== 'proposed') throw new ScheduleError('There is no draft change to send for approval.')
  return { ...f, change: { ...f.change, state: 'awaiting-approval' } }
}

/**
 * Publishes the approved change as a new version. `expectedVersion` is the
 * version the approver reviewed; if the fixture has moved on since, nothing is
 * published and the approver is told to review again.
 */
export function publish(f: Fixture, input: { expectedVersion: number; reason: string; role: string; author: string }): Fixture {
  const change = f.change
  if (!change || change.state !== 'awaiting-approval') throw new ScheduleError('Only a change awaiting approval can be published.')
  if (!canApprove(input.role)) throw new ScheduleError('Your role cannot approve schedule changes for this event.')
  if (!input.reason.trim()) throw new ScheduleError('Give a reason for publishing this change.')
  const latest = publishedVersion(f)
  if (latest !== change.baseVersion || input.expectedVersion !== latest) {
    throw new ScheduleError(`This fixture is now at version ${latest}, not ${input.expectedVersion}. Nothing was published — review the latest version and propose the change again.`)
  }
  return {
    ...f,
    change: undefined,
    // Publishing a new time or place supersedes the conflicting booking.
    conflict: undefined,
    revisions: [
      { version: change.version, startsAt: change.startsAt, venue: change.venue, reason: input.reason.trim(), author: input.author, publishedAt: new Date().toISOString() },
      ...f.revisions,
    ],
  }
}

/** Drops the draft change; a fixture that was never published is removed entirely (null). */
export function discard(f: Fixture): Fixture | null {
  if (f.revisions.length === 0) return null
  return { ...f, change: undefined }
}
