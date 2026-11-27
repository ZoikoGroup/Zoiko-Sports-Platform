import type { ReadinessStatus, VenueReadiness } from '../api/types'

export const READINESS_STATUSES: ReadinessStatus[] = ['ready', 'pending-review', 'needs-attention']

export const READINESS_LABELS: Record<ReadinessStatus, string> = {
  ready: 'Ready',
  'pending-review': 'Pending Review',
  'needs-attention': 'Needs Attention',
}

export const isReadinessStatus = (value: string | null): value is ReadinessStatus =>
  value !== null && (READINESS_STATUSES as string[]).includes(value)

/** "New York, US" — ISO codes as people write them (GB → UK). */
export const placeLabel = (v: Pick<VenueReadiness, 'city' | 'country'>) => `${v.city}, ${v.country === 'GB' ? 'UK' : v.country}`

/** Whole-number percentage, or null when there is nothing to measure. */
export const percent = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : null)

/** The order of the readiness framework card (process stages, not data). */
export const FRAMEWORK_STAGES = [
  { key: 'planning', label: 'Planning', tone: 'blue' },
  { key: 'evidence', label: 'Evidence Submitted', tone: 'violet' },
  { key: 'review', label: 'Review', tone: 'orange' },
  { key: 'ready', label: 'Ready', tone: 'green' },
] as const
