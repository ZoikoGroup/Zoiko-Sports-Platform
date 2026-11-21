/**
 * Display helpers for fixtures (O-11). The scheduling rules themselves (who may
 * propose, approve and publish; refusing a publication when the published
 * version moved) belong to the server: the UI sends the version it reviewed and
 * shows the outcome, and it shows actions only when the fixture lists them in
 * `allowedActions`.
 */
import type { Fixture, FixtureAction } from '../api/types'

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

export const allows = (f: Fixture, action: FixtureAction) => f.allowedActions.includes(action)
