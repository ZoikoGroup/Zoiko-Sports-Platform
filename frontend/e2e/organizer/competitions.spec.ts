// Competitions & Events page.
// No organizer data endpoint exists yet (features/organizer/api/endpoints.ts),
// so pages render their layout with unknown figures and empty lists.
import { expect, test } from '@playwright/test'
import { NOT_CONNECTED, NOT_AVAILABLE_ACTION, signInAsOrganizer, openNavigation, expectUnknown } from './helpers'

test.describe('competitions & events', () => {
  test('opens from the sidebar with its summary, directory and planning sections', async ({ page }) => {
    await signInAsOrganizer(page)
    const nav = await openNavigation(page)
    await nav.getByRole('link', { name: 'Competitions & Events' }).click()
    await expect(page).toHaveURL(/\/organizer\/competitions$/)
    await expect(page).toHaveTitle('Competitions & Events · Organizer · Zoiko Sports')
    await expect(page.getByRole('heading', { level: 1, name: 'Competitions & Events' })).toBeVisible()
    await expect(page.getByTestId('not-connected')).toBeVisible()

    for (const key of ['stat-active', 'stat-upcoming', 'stat-review', 'planning-total', 'planning-confirmed', 'planning-planning', 'planning-draft']) {
      await expectUnknown(page, key)
    }
    for (const heading of ['Competition Directory', 'Needs Attention', 'Event Planning Summary', 'Recent Update']) {
      await expect(page.getByRole('heading', { name: heading })).toBeVisible()
    }
    await expect(page.getByTestId('competition-row')).toHaveCount(0)
    await expect(page.locator('.org-directory')).toContainText(NOT_CONNECTED)
    await expect(page.locator('.org-attention')).toContainText(NOT_CONNECTED)
    await expect(page.getByText('Illustrative sample data')).toHaveCount(0)

    const nav2 = await openNavigation(page)
    await expect(nav2.getByRole('link', { name: 'Competitions & Events' })).toHaveAttribute('aria-current', 'page')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBe(0)
  })

  test('a link to an unknown competition opens no details', async ({ page }) => {
    await signInAsOrganizer(page)
    await page.goto('/organizer/competitions?event=evt-anything')
    await expect(page.getByRole('heading', { level: 1, name: 'Competitions & Events' })).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('creating a competition validates the form, then reports that saving is not available', async ({ page }) => {
    await signInAsOrganizer(page)
    await page.goto('/organizer/competitions')
    await page.getByRole('link', { name: 'Create Competition' }).click()
    const dialog = page.getByRole('dialog', { name: 'Create Competition' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByLabel('Competition name')).toBeFocused()

    await dialog.getByRole('button', { name: 'Create as Draft' }).click()
    await expect(dialog.getByText('Enter a competition name.')).toBeVisible()
    await expect(dialog.getByText('Choose a start date.')).toBeVisible()

    await dialog.getByLabel('Competition name').fill('Harbour City Rugby Sevens')
    await dialog.getByLabel('Sport').selectOption('soccer')
    await dialog.getByLabel('Country').selectOption('AU')
    await dialog.getByLabel('Start date').fill('2027-02-10')
    await dialog.getByLabel('End date').fill('2027-02-01')
    await dialog.getByRole('button', { name: 'Create as Draft' }).click()
    await expect(dialog.getByText('The end date must be on or after the start date.')).toBeVisible()
    await dialog.getByLabel('End date').fill('2027-02-12')
    await dialog.getByRole('button', { name: 'Create as Draft' }).click()

    // Nothing is created in the browser: the form stays open and says why.
    await expect(dialog.getByRole('alert')).toContainText(NOT_AVAILABLE_ACTION)
    await expect(dialog.getByLabel('Competition name')).toHaveValue('Harbour City Rugby Sevens')
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(page.getByTestId('competition-row')).toHaveCount(0)
  })

  test('creating an event needs a competition to add it to', async ({ page }) => {
    await signInAsOrganizer(page)
    // The Overview banner's "Create Event" lands here with the form open.
    await page.getByRole('link', { name: 'Create Event' }).first().click()
    await expect(page).toHaveURL(/\/organizer\/competitions\?new=event$/)
    const dialog = page.getByRole('dialog', { name: 'Create Event' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByLabel('Competition')).toContainText('No competitions available')

    await dialog.getByLabel('Event name').fill('All-Star Exhibition')
    await dialog.getByLabel('Venue').fill('Bayside Arena')
    await dialog.getByLabel('Date').fill('2027-01-20')
    await dialog.getByRole('button', { name: 'Create Event' }).click()
    await expect(dialog.getByText('Choose a competition.')).toBeVisible()
  })

  test('the Overview quick action "Create Competition" opens the form', async ({ page }) => {
    await signInAsOrganizer(page)
    await page.getByRole('link', { name: 'Create Competition' }).click()
    await expect(page).toHaveURL(/\/organizer\/competitions\?new=competition$/)
    await expect(page.getByRole('dialog', { name: 'Create Competition' })).toBeVisible()
  })
})
