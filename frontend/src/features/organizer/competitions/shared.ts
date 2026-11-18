import type { CompetitionEventStatus, CompetitionStatus } from '../api/types'

/** Lifecycle order, used by the stepper and the status filter. */
export const LIFECYCLE: CompetitionStatus[] = ['draft', 'scheduled', 'preparing', 'active', 'completed']

export const COMPETITION_STATUS_LABELS: Record<CompetitionStatus, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  preparing: 'Preparing',
  active: 'Active',
  completed: 'Completed',
}

export const EVENT_STATUS_LABELS: Record<CompetitionEventStatus, string> = {
  confirmed: 'Confirmed',
  planning: 'In Planning',
  draft: 'Draft',
}
