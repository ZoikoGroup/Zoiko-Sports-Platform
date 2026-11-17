import { request } from '../../../api/client'
import { buildMockOverview } from './mockOverview'
import type { OrganizerOverview } from './types'

/**
 * Organizer data access. The UI only talks to this module.
 *
 * The backend has no organizer endpoints yet, so the demo data is served
 * locally (with a short delay, so loading states are exercised). To switch to the
 * real API, set VITE_ORGANIZER_DATA=api once GET /api/v1/organizer/overview/
 * returns the OrganizerOverview shape in types.ts — no component changes.
 */
const USE_API = import.meta.env.VITE_ORGANIZER_DATA === 'api'
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
}
