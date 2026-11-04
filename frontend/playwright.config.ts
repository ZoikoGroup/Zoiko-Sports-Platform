import { defineConfig, devices } from '@playwright/test'
import { randomBytes } from 'node:crypto'

// End-to-end suite: real Django backend + Vite dev server on dedicated ports so
// it never collides with a running development setup.
const WEB = 'http://127.0.0.1:5183'
const API = 'http://127.0.0.1:8010'
// Uses the installed Microsoft Edge (no browser download). Override with
// E2E_BROWSER_CHANNEL=chrome, or leave empty to use Playwright's bundled Chromium.
const channel = process.env.E2E_BROWSER_CHANNEL ?? 'msedge'
// Demo-account password for this run only: generated here, seeded into the
// throwaway backend, and read by the tests (workers inherit the environment).
process.env.E2E_DEMO_PASSWORD ??= `Zs-${randomBytes(9).toString('base64url')}-e2e`

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  // A cold browser process can stall its first navigation for several seconds;
  // these limits absorb that without masking real failures.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: WEB,
    trace: 'retain-on-failure',
    ...(channel ? { channel } : {}),
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Edge'], viewport: { width: 1600, height: 900 } } },
    { name: 'tablet', use: { viewport: { width: 820, height: 1180 }, hasTouch: true } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } },
  ],
  webServer: [
    {
      command: 'node e2e/start-backend.mjs',
      url: `${API}/api/v1/auth/config/`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { E2E_BASE_URL: WEB, ZS_DEMO_PASSWORD: process.env.E2E_DEMO_PASSWORD },
    },
    {
      // The production bundle (what Docker serves), not the dev server: no HMR or
      // on-demand dependency optimisation reloading pages mid-test.
      command: 'npm run build && npx vite preview --host 127.0.0.1',
      url: `${WEB}/login`,
      reuseExistingServer: false,
      timeout: 180_000,
      env: { VITE_PORT: '5183', VITE_API_PROXY_TARGET: API },
    },
  ],
})
