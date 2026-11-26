// Action Centre page.
// No organizer data endpoint exists yet (features/organizer/api/endpoints.ts),
// so pages render their layout with unknown figures and empty lists.
import { expect, test } from '@playwright/test'
import { NOT_CONNECTED, signIn, signInAsOrganizer, openNavigation, expectUnknown } from './helpers'

test.describe('action center', () => {
  test('opens from the sidebar with its sections, empty states and quick actions', async ({ page }, testInfo) => {
    await signInAsOrganizer(page)
    const nav = await openNavigation(page)
    await nav.getByRole('link', { name: /Action Center/ }).click()
    await expect(page).toHaveURL(/\/organizer\/action-center$/)
    await expect(page).toHaveTitle('Action Center · Organizer · Zoiko Sports')
    await expect(page.getByRole('heading', { level: 1, name: 'Action Center' })).toBeVisible()
    await expect(page.getByTestId('not-connected')).toBeVisible()

    for (const key of ['actions', 'approvals', 'deadlines', 'alerts']) {
      await expectUnknown(page, `summary-${key}`)
    }
    for (const heading of ['Action Queue (Prioritized)', 'Approval Requests', 'Operational Alerts', 'Upcoming Deadlines', 'Quick Actions']) {
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
    }
    await expect(page.getByTestId('action-item')).toHaveCount(0)
    await expect(page.getByTestId('approval-group')).toHaveCount(0)
    await expect(page.getByTestId('deadline')).toHaveCount(0)
    for (const section of ['#ac-queue', '#ac-approvals', '#ac-alerts', '#ac-deadlines']) {
      await expect(page.locator(section)).toContainText(NOT_CONNECTED)
    }
    // Nothing to expand, so no "View All (n)" toggles.
    await expect(page.getByRole('button', { name: /^View All/ })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Send Communication' })).toBeVisible()

    const nav2 = await openNavigation(page)
    await expect(nav2.getByRole('link', { name: /Action Center/ })).toHaveAttribute('aria-current', 'page')

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBe(0)
    await page.screenshot({ path: testInfo.outputPath('action-center.png'), fullPage: true })
  })

  test('summary cards jump to their section', async ({ page }) => {
    await signInAsOrganizer(page)
    await page.goto('/organizer/action-center')
    await page.getByTestId('summary-deadlines').click()
    await expect(page).toHaveURL(/#ac-deadlines$/)
    await expect(page.locator('#ac-deadlines')).toBeInViewport()
  })

  test('only organizers can open it', async ({ page }) => {
    await page.goto('/organizer/action-center')
    await expect(page).toHaveURL(/\/login$/)
    await signIn(page, 'venue@zoikosports.test', 'Venue (Stadium / Arena)')
    await expect(page).toHaveURL(/\/workspace$/)
  })
})
