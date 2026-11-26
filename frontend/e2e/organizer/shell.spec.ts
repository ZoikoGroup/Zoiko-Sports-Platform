// Workspace shell: route protection, navigation, search, notifications, theme, switching.
// No organizer data endpoint exists yet (features/organizer/api/endpoints.ts),
// so pages render their layout with unknown figures and empty lists.
import { expect, test } from '@playwright/test'
import { NOT_CONNECTED, signIn, signInAsOrganizer, openNavigation } from './helpers'

test.describe('role-based route protection', () => {
  for (const { email, radio } of [
    { email: 'venue@zoikosports.test', radio: 'Venue (Stadium / Arena)' },
    { email: 'club@zoikosports.test', radio: 'Team / Club (Sports Team)' },
    { email: 'individual@zoikosports.test', radio: 'Individual (Participant / Staff)' },
  ]) {
    test(`${radio} cannot open the Organizer workspace`, async ({ page }) => {
      await page.goto('/login')
      await signIn(page, email, radio)
      await expect(page).toHaveURL(/\/workspace$/)
      await page.goto('/organizer/overview')
      await expect(page).toHaveURL(/\/workspace$/)
      await page.goto('/organizer/fixtures')
      await expect(page).toHaveURL(/\/workspace$/)
    })
  }

  test('a multi-role account signed in to another workspace is kept out', async ({ page }) => {
    await page.goto('/login')
    await signIn(page, 'demo@zoikosports.test', 'Venue (Stadium / Arena)')
    await expect(page).toHaveURL(/\/workspace$/)
    await page.goto('/organizer/overview')
    await expect(page).toHaveURL(/\/workspace$/)
  })
})

test.describe('dashboard navigation and controls', () => {
  test('sidebar links open each module inside the shell', async ({ page }) => {
    await signInAsOrganizer(page)
    let nav = await openNavigation(page)
    await nav.getByRole('link', { name: 'Fixtures & Schedule' }).click()
    await expect(page).toHaveURL(/\/organizer\/fixtures$/)
    await expect(page.getByRole('heading', { level: 1, name: /Fixtures & Schedule/ })).toBeVisible()
    await expect(page).toHaveTitle('Fixtures & Schedule · Organizer · Zoiko Sports')

    nav = await openNavigation(page)
    await expect(nav.getByRole('link', { name: 'Fixtures & Schedule' })).toHaveAttribute('aria-current', 'page')
    await nav.getByRole('link', { name: 'Team & Access' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Team & Access' })).toBeVisible()

    // Pages no longer in the sidebar keep working at their addresses.
    await page.goto('/organizer/venue-operations')
    await expect(page.getByRole('heading', { name: 'Workspace coming soon' })).toBeVisible()

    await page.getByRole('link', { name: 'Back to Overview' }).click()
    await expect(page).toHaveURL(/\/organizer\/overview$/)

    await page.goto('/organizer/not-a-module')
    await expect(page).toHaveURL(/\/organizer\/overview$/)
    await page.goto('/organizer')
    await expect(page).toHaveURL(/\/organizer\/overview$/)
  })

  test('the region scope and event filters stay usable without data', async ({ page }) => {
    await signInAsOrganizer(page)
    await page.getByRole('button', { name: /^Region:/ }).click()
    await page.getByRole('menuitemradio', { name: 'Europe', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Region: Europe' })).toBeVisible()

    await page.getByRole('button', { name: /^Filter events/ }).click()
    await page.getByRole('menuitemradio', { name: 'Next 90 days', exact: true }).click()
    await expect(page.getByTestId('upcoming-event')).toHaveCount(0)
    await expect(page.locator('.org-events')).toContainText(NOT_CONNECTED)
    await expect(page.getByLabel('Period')).toBeDisabled()
  })

  test('search finds modules and invents no events', async ({ page }) => {
    await signInAsOrganizer(page)
    const search = page.getByRole('combobox', { name: /Search competitions/ })
    await search.fill('cricket')
    await expect(page.getByRole('listbox', { name: 'Search results' }).getByRole('option')).toHaveCount(0)
    await expect(page.getByText('No matches for “cricket”')).toBeVisible()

    await page.keyboard.press('Control+k')
    await expect(search).toBeFocused()
    await search.fill('readiness')
    await page.getByRole('option', { name: /Venues & Readiness/ }).click()
    await expect(page).toHaveURL(/\/organizer\/venues$/)
  })

  test('notifications say they are not connected and close with Escape', async ({ page }) => {
    await signInAsOrganizer(page)
    const bell = page.getByRole('button', { name: 'Notifications', exact: true })
    await bell.click()
    const panel = page.getByRole('dialog', { name: /Notifications/ })
    await expect(panel).toContainText("Notifications aren't connected yet.")
    await expect(panel).not.toContainText('unread')
    await page.keyboard.press('Escape')
    await expect(panel).toBeHidden()
    await expect(bell).toBeFocused()
  })

  test('the theme choice in the account menu restyles the dashboard', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await signInAsOrganizer(page)
    const cardBackground = () => page.locator('.org-alerts').evaluate((el) => getComputedStyle(el).backgroundColor)
    expect(await cardBackground()).toBe('rgb(255, 255, 255)')

    await page.getByRole('button', { name: 'Account: Olivia Organizer' }).click()
    await page.getByRole('menuitemradio', { name: 'Dark theme' }).click()
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark')
    await expect.poll(cardBackground).toBe('rgb(18, 26, 66)')

    await page.reload()
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark')
  })

  test('switching workspace keeps the session and clears the previous workspace', async ({ page }) => {
    await page.goto('/login')
    await signIn(page, 'demo@zoikosports.test')
    await expect(page).toHaveURL(/\/organizer\/overview$/)

    await openNavigation(page)
    await page.getByRole('button', { name: 'Switch workspace' }).click()
    await expect(page.getByRole('menuitemradio', { name: /Organizer · Riverside Invitational/ })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    await page.getByRole('menuitemradio', { name: /Venue · Northfield Arena/ }).click()

    // Still signed in: straight to the Venue workspace, never the sign-in page.
    await expect(page).toHaveURL(/\/workspace$/)
    await expect(page.getByTestId('workspace-organization')).toHaveText('Northfield Arena')
    // The organizer pages are closed to this workspace now.
    await page.goto('/organizer/overview')
    await expect(page).toHaveURL(/\/workspace$/)

    await page.getByRole('button', { name: 'Switch workspace' }).click()
    await page.getByRole('button', { name: /Organizer · Riverside Invitational/ }).click()
    await expect(page).toHaveURL(/\/organizer\/overview$/)
    await expect(page.getByTestId('organizer-overview')).toBeVisible()
  })

  test('the navigation drawer opens and closes on small screens', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'desktop', 'drawer only below 1024px')
    await signInAsOrganizer(page)
    const nav = page.getByRole('navigation', { name: 'Organizer workspace' })
    await expect(nav).toBeHidden()
    await page.getByRole('button', { name: 'Open navigation' }).click()
    await expect(nav).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(nav).toBeHidden()
    await page.getByRole('button', { name: 'Open navigation' }).click()
    await page.getByRole('button', { name: 'Close navigation' }).click()
    await expect(nav).toBeHidden()
  })
})
