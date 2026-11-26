// Fixtures & Schedule page.
// No organizer data endpoint exists yet (features/organizer/api/endpoints.ts),
// so pages render their layout with unknown figures and empty lists.
import { expect, test } from '@playwright/test'
import { NOT_CONNECTED, NOT_AVAILABLE_ACTION, signInAsOrganizer, openNavigation, expectUnknown } from './helpers'

test.describe('fixtures & schedule', () => {
  test('opens from the sidebar with summary, list, calendar and conflicts', async ({ page }) => {
    await signInAsOrganizer(page)
    const nav = await openNavigation(page)
    await nav.getByRole('link', { name: 'Fixtures & Schedule' }).click()
    await expect(page).toHaveURL(/\/organizer\/fixtures$/)
    await expect(page).toHaveTitle('Fixtures & Schedule · Organizer · Zoiko Sports')
    await expect(page.getByRole('heading', { level: 1, name: 'Fixtures & Schedule' })).toBeVisible()
    await expect(page.getByTestId('not-connected')).toBeVisible()

    for (const key of ['total', 'confirmed', 'pending', 'conflicts']) {
      await expectUnknown(page, `fx-stat-${key}`)
    }
    await expect(page.getByTestId('fixture-row')).toHaveCount(0)
    await expect(page.locator('.org-fixtures')).toContainText(NOT_CONNECTED)

    await expect(page.getByRole('heading', { name: 'Schedule Calendar' })).toBeVisible()
    await expect(page.getByRole('list', { name: 'Legend' })).toContainText('Key Matches')
    await expect(page.locator('.org-calendar__day.has-fixtures')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Conflicts to Review' })).toBeVisible()
    await expect(page.locator('.org-conflicts')).toContainText(NOT_CONNECTED)
    await expect(page.getByText('Sample data is illustrative')).toHaveCount(0)

    const nav2 = await openNavigation(page)
    await expect(nav2.getByRole('link', { name: 'Fixtures & Schedule' })).toHaveAttribute('aria-current', 'page')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBe(0)
  })

  test('links from other pages arrive filtered and open nothing unknown', async ({ page }) => {
    await signInAsOrganizer(page)
    await page.goto('/organizer/fixtures?approvals=fixture&fixture=fx-unknown')
    await expect(page.getByRole('button', { name: /^Showing pending/ })).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('a new fixture validates and needs a competition', async ({ page }) => {
    await signInAsOrganizer(page)
    await page.goto('/organizer/fixtures')
    await page.getByRole('link', { name: 'Create Fixture' }).click()
    const dialog = page.getByRole('dialog', { name: 'Create Fixture' })
    await expect(dialog.getByLabel('Home')).toBeFocused()
    await expect(dialog.getByLabel('Competition')).toContainText('No competitions available')

    await dialog.getByRole('button', { name: 'Create Draft Fixture' }).click()
    await expect(dialog.getByText('Enter the home team or player.')).toBeVisible()
    await expect(dialog.getByText('Choose a competition.')).toBeVisible()

    await dialog.getByLabel('Home').fill('Northern Owls')
    await dialog.getByLabel('Away').fill('northern owls')
    await dialog.getByRole('button', { name: 'Create Draft Fixture' }).click()
    await expect(dialog.getByText('Home and away must be different.')).toBeVisible()
  })

  test('import and calendar sync explain they are not available yet', async ({ page }) => {
    await signInAsOrganizer(page)
    await page.goto('/organizer/fixtures')
    await page.getByRole('button', { name: 'Import Schedule' }).click()
    await expect(page.getByRole('dialog', { name: 'Import Schedule' })).toContainText(NOT_AVAILABLE_ACTION)
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Sync Calendar' }).click()
    await expect(page.getByRole('dialog', { name: 'Sync Calendar' })).toContainText(NOT_AVAILABLE_ACTION)
  })
})
