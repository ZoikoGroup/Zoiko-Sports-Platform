// Overview: sign-in lands here; session, redirects and deep links.
// No organizer data endpoint exists yet (features/organizer/api/endpoints.ts),
// so pages render their layout with unknown figures and empty lists.
import { expect, test } from '@playwright/test'
import { NOT_CONNECTED, signIn, signInAsOrganizer, openNavigation, expectUnknown } from './helpers'

test.describe('organizer login to dashboard', () => {
  test('an organizer lands on the Overview with every section and no invented data', async ({ page }, testInfo) => {
    await signInAsOrganizer(page)
    await expect(page).toHaveTitle('Overview · Organizer · Zoiko Sports')

    await expect(page.getByRole('heading', { level: 1, name: 'Global Competition Operations' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Create Event' }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'View Calendar' })).toBeVisible()
    await expect(page.getByTestId('not-connected')).toContainText(NOT_CONNECTED)

    for (const id of ['active-competitions', 'total-events', 'participating-organizations', 'countries-regions']) {
      await expectUnknown(page, `kpi-${id}`)
    }

    for (const heading of [
      'Upcoming Events & Fixtures',
      'Competition Activity',
      'Global Participation',
      'Operational Alerts',
      'Tasks & Approvals',
      'Quick Actions',
      'Recent Updates',
    ]) {
      await expect(page.getByRole('heading', { name: heading })).toBeVisible()
    }
    await expect(page.getByTestId('upcoming-event')).toHaveCount(0)
    for (const card of ['.org-events', '.org-activity', '.org-alerts', '.org-tasks', '.org-updates']) {
      await expect(page.locator(card)).toContainText(NOT_CONNECTED)
    }
    // Empty lists do not claim "nothing to do" while data is not connected.
    await expect(page.getByText('No open alerts.')).toHaveCount(0)
    await expect(page.getByRole('img', { name: /World map; no participating regions/ })).toBeVisible()
    await expect(page.locator('.org-participation__stats')).not.toContainText(/\d/)
    await expect(page.getByRole('link', { name: 'Create Competition' })).toBeVisible()

    // The signed-in identity comes from the session.
    await expect(page.getByRole('button', { name: 'Account: Olivia Organizer' })).toBeVisible()
    if (testInfo.project.name === 'desktop') {
      await expect(page.getByTestId('organizer-user-name')).toHaveText('Olivia Organizer')
      await expect(page.getByText('Competition director', { exact: true })).toBeVisible()
    }

    const nav = await openNavigation(page)
    await expect(nav.getByRole('link', { name: 'Overview', exact: true })).toHaveAttribute('aria-current', 'page')
    // No count is shown for the Action Center until the server provides one.
    await expect(nav.getByRole('link', { name: /Action Center/ })).toHaveText('Action Center')
    for (const group of ['Core Workspace', 'Competition Operations', 'Management & Oversight', 'Engagement & Services', 'Settings & Configuration']) {
      await expect(nav.getByRole('heading', { name: group })).toBeVisible()
    }
    await expect(nav.getByRole('link', { name: 'Sponsorships & Partners' })).toBeVisible()

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBe(0)
    await page.screenshot({ path: testInfo.outputPath('organizer-overview.png'), fullPage: true })
  })

  test('the session survives a reload and sign-out ends it', async ({ page }) => {
    await signInAsOrganizer(page)
    await page.reload()
    await expect(page.getByTestId('organizer-overview')).toBeVisible()

    await page.getByRole('button', { name: 'Account: Olivia Organizer' }).click()
    await page.getByRole('menuitem', { name: 'Sign out' }).click()
    await expect(page).toHaveURL(/\/login$/)
    await page.goto('/organizer/overview')
    await expect(page).toHaveURL(/\/login$/)
  })

  test('a signed-in organizer visiting sign-in is sent to the dashboard', async ({ page }) => {
    await signInAsOrganizer(page)
    await page.goto('/login')
    await expect(page).toHaveURL(/\/organizer\/overview$/)
  })

  test('deep links into the workspace return there after sign-in', async ({ page }) => {
    await page.goto('/organizer/fixtures')
    await expect(page).toHaveURL(/\/login$/)
    await signIn(page, 'organizer@zoikosports.test')
    await expect(page).toHaveURL(/\/organizer\/fixtures$/)
    await expect(page.getByRole('heading', { level: 1, name: /Fixtures & Schedule/ })).toBeVisible()
  })
})
