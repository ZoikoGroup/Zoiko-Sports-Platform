// Venues & Readiness, on live data (backend P12.1, D-047).
// The e2e backend runs seed_demo: Riverside Invitational's competition at five fictional venues
// (backend/accounts/management/demo_readiness.py):
//   Northfield Arena (pending review; 16 checks, 14 shared), Harbour Point Stadium (ready),
//   Lakeside Park (needs attention), Southern Cross Ground (pending review), Bayfront Arena (ready).
import { expect, test, type Page } from '@playwright/test'
import { openNavigation, signInAsOrganizer } from './helpers'

const VENUES = ['Northfield Arena', 'Lakeside Park', 'Harbour Point Stadium', 'Bayfront Arena', 'Southern Cross Ground']

async function openVenues(page: Page, query = '') {
  await signInAsOrganizer(page)
  await page.goto(`/organizer/venues${query}`)
  await expect(page.getByRole('heading', { level: 1, name: 'Venues & Readiness' })).toBeVisible()
  await expect(page.getByTestId('venue-row').first()).toBeVisible()
}

const rows = (page: Page) => page.getByTestId('venue-row')
const rowNames = (page: Page) => rows(page).locator('th .org-table__link')

test.describe('venues & readiness', () => {
  test('opens from the sidebar with live totals that match the queue', async ({ page }) => {
    await signInAsOrganizer(page)
    const nav = await openNavigation(page)
    await nav.getByRole('link', { name: 'Venues & Readiness' }).click()
    await expect(page).toHaveURL(/\/organizer\/venues$/)
    await expect(page).toHaveTitle('Venues & Readiness · Organizer · Zoiko Sports')
    await expect(page.getByTestId('venue-row').first()).toBeVisible()
    // Live: no "not connected" notice, real figures.
    await expect(page.getByTestId('not-connected')).toHaveCount(0)
    await expect(page.getByTestId('vr-stat-total')).toContainText('5')
    await expect(page.getByTestId('vr-stat-ready')).toContainText('2')
    await expect(page.getByTestId('vr-stat-pending')).toContainText('2')
    await expect(page.getByTestId('vr-stat-attention')).toContainText('1')

    // Soonest event first; every seeded venue is listed once.
    await expect(rowNames(page)).toHaveText(VENUES)
    await expect(page.getByTestId('vr-tab-all')).toHaveText('All Venues (5)')
    await expect(page.getByTestId('vr-tab-ready')).toHaveText('Ready (2)')
    const northfield = rows(page).filter({ hasText: 'Northfield Arena' })
    await expect(northfield).toContainText('Riverside Cup: Opening Round')
    await expect(northfield).toContainText('Riverside Invitational Cup')
    await expect(northfield).toContainText('Sacramento, US')
    await expect(northfield).toContainText('Pending Review')
    await expect(page.getByText(/illustrative sample data/i)).toHaveCount(0)

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBe(0)
  })

  test('status tabs and the status filter filter the queue and stay in the address', async ({ page }) => {
    await openVenues(page)
    const status = page.getByRole('combobox', { name: 'Status' })

    await page.getByTestId('vr-tab-ready').click()
    await expect(page).toHaveURL(/status=ready/)
    await expect(rowNames(page)).toHaveText(['Harbour Point Stadium', 'Bayfront Arena'])
    await expect(status).toHaveValue('ready')

    await status.selectOption('needs-attention')
    await expect(page.getByTestId('vr-tab-needs-attention')).toHaveAttribute('aria-pressed', 'true')
    await expect(rowNames(page)).toHaveText(['Lakeside Park'])
    await expect(rows(page)).toContainText('Needs Attention')

    await page.getByTestId('vr-tab-all').click()
    await expect(page).not.toHaveURL(/status=/)
    await expect(rows(page)).toHaveCount(5)

    // The address keeps the filter; unknown values are ignored.
    await page.goto('/organizer/venues?status=pending-review')
    await expect(rowNames(page)).toHaveText(['Northfield Arena', 'Southern Cross Ground'])
    await page.goto('/organizer/venues?status=bogus')
    await expect(page.getByTestId('vr-tab-all')).toHaveAttribute('aria-pressed', 'true')
  })

  test('needs attention lists the problems, critical first, and opens the venue', async ({ page }) => {
    await openVenues(page)
    const card = page.locator('.org-vr-attention')
    const items = card.locator('.org-vr-attention__row')
    await expect(items).toHaveCount(2)
    await expect(items.nth(0)).toContainText('Lakeside Park')
    await expect(items.nth(0)).toContainText('Fire safety certificate: changes requested')
    await expect(items.nth(0)).toContainText('High')
    await expect(items.nth(1)).toContainText('Crowd management plan is overdue')
    await expect(items.nth(1)).toContainText('Medium')

    await items.nth(0).click()
    const drawer = page.getByTestId('venue-drawer')
    await expect(drawer.getByRole('heading', { name: 'Lakeside Park' })).toBeVisible()
    await expect(drawer.getByRole('note')).toContainText('The certificate on file expired in October')
    await page.keyboard.press('Escape')
    await expect(drawer).toBeHidden()

    await card.getByRole('button', { name: /View all/ }).click()
    await expect(page).toHaveURL(/status=needs-attention/)
    await expect(rowNames(page)).toHaveText(['Lakeside Park'])
  })

  test('the details show only the checks the venue shared', async ({ page }) => {
    await openVenues(page)
    await rows(page).getByRole('button', { name: 'Northfield Arena', exact: true }).click()
    await expect(page).toHaveURL(/venue=/)
    const drawer = page.getByTestId('venue-drawer')
    await expect(drawer.getByRole('heading', { name: 'Northfield Arena' })).toBeVisible()
    await expect(drawer.getByTestId('venue-checks').locator('li')).toHaveCount(14)
    await expect(drawer).toContainText('7 of 14')
    await expect(drawer).toContainText('Emergency evacuation plan')
    // The venue's two private checks never reach the organizer.
    await expect(drawer).not.toContainText('Internal staffing roster')
    await expect(drawer).not.toContainText('Catering supplier contracts')

    // The open drawer survives a reload (it lives in the address).
    await page.reload()
    await expect(page.getByTestId('venue-drawer').getByRole('heading', { name: 'Northfield Arena' })).toBeVisible()
  })

  test('an organizer asks a venue for an update', async ({ page }) => {
    await openVenues(page)
    const row = rows(page).filter({ hasText: 'Southern Cross Ground' })
    await row.getByRole('button', { name: 'Actions for Southern Cross Ground' }).click()
    await page.getByRole('menuitem', { name: 'Request an update' }).click()

    const drawer = page.getByTestId('venue-drawer')
    const message = drawer.getByLabel('Message to Southern Cross Ground')
    await expect(message).toBeFocused()
    await drawer.getByRole('button', { name: 'Send request' }).click()
    await expect(drawer.getByRole('alert')).toHaveText(/Say what the venue should update/)

    await message.fill('Please submit the stewarding plan before Friday.')
    const sent = page.waitForResponse((r) => r.url().includes('/update-requests/') && r.request().method() === 'POST')
    await drawer.getByRole('button', { name: 'Send request' }).click()
    const response = await sent
    expect(response.status()).toBe(201)
    expect(response.request().headers()['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/)
    await expect(drawer.getByRole('status')).toHaveText(/Request sent/)
    await expect(message).toHaveValue('')
  })

  test('regions, competition and today’s activity come from the same data', async ({ page }) => {
    await openVenues(page)
    const regions = page.locator('.org-vr-region')
    await expect(regions).toHaveCount(4)
    await expect(regions.nth(0)).toContainText('North America')
    await expect(regions.nth(0)).toContainText('0 / 2 Ready')
    await expect(page.locator('.org-vr-regions')).toContainText('1 / 1 Ready')

    await regions.filter({ hasText: 'Europe' }).click()
    await expect(page.getByRole('combobox', { name: 'Region' })).toHaveValue('europe')
    await expect(rowNames(page)).toHaveText(['Harbour Point Stadium'])
    await page.getByRole('combobox', { name: 'Region' }).selectOption('all')

    const competition = page.getByRole('combobox', { name: 'Competition', exact: true })
    await expect(competition.locator('option')).toHaveText(['All Competitions', 'Riverside Invitational Cup'])

    // Several venues have something today in their own time zone (seeded relative to now).
    await expect(page.locator('.org-vr-activity .org-list__row').first()).toBeVisible()
  })

  test('hero actions lead to the review queue and the calendar', async ({ page }) => {
    await openVenues(page)
    await page.getByRole('button', { name: 'Review Readiness' }).click()
    await expect(page).toHaveURL(/status=pending-review/)
    await expect(page.getByRole('heading', { name: 'Venue Readiness Queue' })).toBeFocused()

    await page.getByRole('link', { name: 'Venue Calendar' }).click()
    await expect(page).toHaveURL(/\/organizer\/fixtures$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Fixtures & Schedule' })).toBeVisible()
  })

  test('links from other pages arrive filtered and open nothing unknown', async ({ page }) => {
    await openVenues(page)
    await page.goto('/organizer/venues?competition=cmp-anything&venue=vr-anything')
    const competition = page.getByRole('combobox', { name: 'Competition', exact: true })
    await expect(competition).toHaveValue('cmp-anything')
    await expect(page.getByText('No venues match these filters.')).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)

    await competition.selectOption('all')
    await expect(page).not.toHaveURL(/competition=/)
    await expect(rows(page)).toHaveCount(5)
  })
})
