import { request } from '../../../api/client'
import { buildMockActionCenter } from './mockActionCenter'
import { buildMockCompetitions } from './mockCompetitions'
import { buildMockFixtures } from './mockFixtures'
import { buildMockOverview } from './mockOverview'
import type { ActionCenterData, CompetitionsData, FixturesData, OrganizerOverview } from './types'

/**
 * Organizer data access. The UI only talks to this module.
 *
 * The backend has no organizer endpoints yet, so the demo data is served
 * locally (with a short delay, so loading states are exercised). To switch to the
 * real API, set VITE_ORGANIZER_DATA=api once GET /api/v1/organizer/overview/,
 * /action-center/, /competitions/ and /fixtures/ return the shapes in types.ts
 * — no component changes.
 */
const USE_API = import.meta.env.VITE_ORGANIZER_DATA === 'api'

/** True while pages show demo data (labelled as such in the UI). */
export const USING_DEMO_DATA = !USE_API
const MOCK_LATENCY_MS = 150

function mock<T>(build: () => T, signal?: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => resolve(build()), MOCK_LATENCY_MS)
    signal?.addEventListener('abort', () => {
      window.clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    })
  })
}

export const organizerApi = {
  overview: (signal?: AbortSignal): Promise<OrganizerOverview> =>
    USE_API ? request<OrganizerOverview>('GET', '/api/v1/organizer/overview/') : mock(() => buildMockOverview(), signal),
  actionCenter: (signal?: AbortSignal): Promise<ActionCenterData> =>
    USE_API
      ? request<ActionCenterData>('GET', '/api/v1/organizer/action-center/')
      : mock(() => buildMockActionCenter(), signal),
  competitions: (signal?: AbortSignal): Promise<CompetitionsData> =>
    USE_API
      ? request<CompetitionsData>('GET', '/api/v1/organizer/competitions/')
      : mock(() => buildMockCompetitions(), signal),
  fixtures: (signal?: AbortSignal): Promise<FixturesData> =>
    USE_API ? request<FixturesData>('GET', '/api/v1/organizer/fixtures/') : mock(() => buildMockFixtures(), signal),
}
