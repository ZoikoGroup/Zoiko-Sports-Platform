/**
 * GET /api/v1/organizer/venues/ (backend workspaces/organizer/venues.py) in the
 * Venues & Readiness view model (types.ts). The API uses the backend's
 * snake_case names and codes; the page keeps its own.
 */
import type { ReadinessStatus, RegionId, VenueActivityItem, VenuesData } from './types'

type ApiRegion = 'north_america' | 'south_america' | 'europe' | 'africa' | 'asia' | 'oceania'
type ApiStatus = 'ready' | 'pending_review' | 'needs_attention'

export interface VenuesResponse {
  generated_at: string
  summary: { total: number; ready: number; pending_review: number; needs_attention: number }
  venues: {
    id: string
    venue_id: string
    venue: string
    event_id: string
    event: string
    competition_id: string
    competition: string
    city: string
    country: string
    region: ApiRegion
    time_zone: string
    starts_at: string
    status: ApiStatus
    evidence_items: number
    checks: { complete: number; total: number } | null
    issue: string | null
    check_list: { id: string; title: string; state: 'complete' | 'pending' | 'attention'; label: string }[]
  }[]
  attention: { id: string; readiness_id: string; venue: string; detail: string; severity: 'high' | 'medium' | 'low' }[]
  activity: {
    id: string
    readiness_id: string
    venue: string
    summary: string
    kind: 'completed' | 'in_progress' | 'scheduled'
    at: string
    time_zone: string
  }[]
  regions: { region: ApiRegion; ready: number; total: number }[]
}

const REGIONS: Record<ApiRegion, RegionId> = {
  north_america: 'north-america',
  south_america: 'south-america',
  europe: 'europe',
  africa: 'africa',
  asia: 'asia',
  oceania: 'oceania',
}

const STATUSES: Record<ApiStatus, ReadinessStatus> = {
  ready: 'ready',
  pending_review: 'pending-review',
  needs_attention: 'needs-attention',
}

const KINDS: Record<VenuesResponse['activity'][number]['kind'], VenueActivityItem['kind']> = {
  completed: 'completed',
  in_progress: 'in-progress',
  scheduled: 'scheduled',
}

export function toVenuesData(response: VenuesResponse): VenuesData {
  return {
    generatedAt: response.generated_at,
    summary: {
      totalVenues: response.summary.total,
      ready: response.summary.ready,
      pendingReview: response.summary.pending_review,
      needsAttention: response.summary.needs_attention,
    },
    venues: response.venues.map((v) => ({
      id: v.id,
      venueId: v.venue_id,
      venue: v.venue,
      event: v.event,
      competitionId: v.competition_id,
      competition: v.competition,
      city: v.city,
      country: v.country,
      region: REGIONS[v.region],
      timeZone: v.time_zone,
      startsAt: v.starts_at,
      status: STATUSES[v.status],
      evidenceItems: v.evidence_items,
      checks: v.checks,
      issue: v.issue ?? undefined,
      checkList: v.check_list,
    })),
    attention: response.attention.map((a) => ({
      id: a.id,
      readinessId: a.readiness_id,
      venue: a.venue,
      detail: a.detail,
      severity: a.severity,
    })),
    activity: response.activity.map((a) => ({
      id: a.id,
      readinessId: a.readiness_id,
      venue: a.venue,
      summary: a.summary,
      kind: KINDS[a.kind],
      at: a.at,
      timeZone: a.time_zone,
    })),
    regions: response.regions.map((r) => ({ region: REGIONS[r.region], ready: r.ready, total: r.total })),
  }
}
