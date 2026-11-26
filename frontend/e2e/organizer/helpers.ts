// Shared by the Organizer browser tests (one spec file per page).
import { expect, type Page } from '@playwright/test'

// Random per run (playwright.config.ts) and seeded into the throwaway backend.
export const DEMO_PASSWORD = process.env.E2E_DEMO_PASSWORD!
export const ORGANIZATION = 'Organization (League / Event)'

// No organizer data endpoint exists yet (features/organizer/api/endpoints.ts),
// so every page renders its layout with unknown figures and empty lists.
export const NOT_CONNECTED = "Live data isn't connected yet."
export const NOT_AVAILABLE_ACTION = "isn't available yet"

export async function signIn(page: Page, email: string, workspace = ORGANIZATION) {
  await page.getByRole('radio', { name: workspace }).check()
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(DEMO_PASSWORD)
  await page.getByRole('button', { name: 'Sign In', exact: true }).click()
}

export async function signInAsOrganizer(page: Page) {
  await page.goto('/login')
  await signIn(page, 'organizer@zoikosports.test')
  await expect(page).toHaveURL(/\/organizer\/overview$/)
  await expect(page.getByTestId('organizer-overview')).toBeVisible()
}

/** The sidebar is a drawer below 1024px: open it first there. */
export async function openNavigation(page: Page) {
  // The shell loads lazily: wait for it before deciding whether the drawer exists.
  await expect(page.getByRole('combobox', { name: /Search competitions, events/ })).toBeVisible()
  const toggle = page.getByRole('button', { name: 'Open navigation' })
  if (await toggle.isVisible()) await toggle.click()
  return page.getByRole('navigation', { name: 'Organizer workspace' })
}

/** A figure the server has not provided reads "—", never an invented number. */
export async function expectUnknown(page: Page, testId: string) {
  const card = page.getByTestId(testId)
  await expect(card).toContainText('—')
  await expect(card).toContainText('Not available')
  await expect(card).not.toContainText(/\d/)
}
