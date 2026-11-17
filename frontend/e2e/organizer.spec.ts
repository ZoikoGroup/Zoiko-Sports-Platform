import { expect, test, type Page } from '@playwright/test'

// Random per run (playwright.config.ts) and seeded into the throwaway backend.
const DEMO_PASSWORD = process.env.E2E_DEMO_PASSWORD!
const ORGANIZATION = 'Organization (League / Event)'

async function signIn(page: Page, email: string, workspace = ORGANIZATION) {
  await page.getByRole('radio', { name: workspace }).check()
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(DEMO_PASSWORD)
  await page.getByRole('button', { name: 'Sign In', exact: true }).click()
}

async function signInAsOrganizer(page: Page) {
  await page.goto('/login')
  await signIn(page, 'organizer@zoikosports.test')
  await expect(page).toHaveURL(/\/organizer\/overview$/)
  await expect(page.getByTestId('organizer-overview')).toBeVisible()
}

/** The sidebar is a drawer below 1024px: open it first there. */
async function openNavigation(page: Page) {
  // The shell loads lazily: wait for it before deciding whether the drawer exists.
  await expect(page.getByRole('search')).toBeVisible()
  const toggle = page.getByRole('button', { name: 'Open navigation' })
  if (await toggle.isVisible()) await toggle.click()
  return page.getByRole('navigation', { name: 'Organizer workspace' })
}

test.describe('organizer login to dashboard', () => {
  test('an organizer lands on the Overview with every section of the design', async ({ page }, testInfo) => {
    await signInAsOrganizer(page)
    await expect(page).toHaveTitle('Overview · Organizer · Zoiko Sports')

    await expect(page.getByRole('heading', { level: 1, name: 'Global Competition Operations' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Create Event' }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'View Calendar' })).toBeVisible()

    for (const [id, value] of [
      ['active-competitions', '142'],
      ['total-events', '1,248'],
      ['participating-organizations', '2,847'],
      ['countries-regions', '196'],
    ]) {
      await expect(page.getByTestId(`kpi-${id}`)).toContainText(value)
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
    await expect(page.getByTestId('upcoming-event')).toHaveCount(4)
    await expect(page.getByRole('img', { name: /Competitions per month/ })).toBeVisible()
    await expect(page.getByRole('img', { name: /World map marking regions with participants/ })).toBeVisible()
    await expect(page.getByText('18,420')).toBeVisible()

    // The signed-in identity comes from the session, not from mock data.
    await expect(page.getByRole('button', { name: 'Account: Olivia Organizer' })).toBeVisible()
    if (testInfo.project.name === 'desktop') {
      await expect(page.getByTestId('organizer-user-name')).toHaveText('Olivia Organizer')
      await expect(page.getByText('Competition Director', { exact: true })).toBeVisible()
    }

    const nav = await openNavigation(page)
    await expect(nav.getByRole('link', { name: 'Overview', exact: true })).toHaveAttribute('aria-current', 'page')
    await expect(nav.getByRole('link', { name: /Action Center/ })).toContainText('8')
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

  test('upcoming events filter by sport, region and period', async ({ page }) => {
    await signInAsOrganizer(page)
    const rows = page.getByTestId('upcoming-event')
    const filter = async (choice: string) => {
      await page.getByRole('button', { name: /^Filter events/ }).click()
      await page.getByRole('menuitemradio', { name: choice, exact: true }).click()
    }
    const region = async (choice: string) => {
      await page.getByRole('button', { name: /^Region:/ }).click()
      await page.getByRole('menuitemradio', { name: choice, exact: true }).click()
    }

    await expect(rows).toHaveCount(4)
    await filter('Cricket')
    await expect(rows).toHaveCount(1)
    await expect(rows.first()).toContainText('World Cricket Qualifier')
    await filter('All sports')

    // The top-bar region scopes the list; the default period is the next 30 days.
    await region('Europe')
    await expect(page.getByText('No events match Europe · Next 30 days.')).toBeVisible()
    await filter('Next 90 days')
    await expect(rows).toHaveCount(1)
    await expect(rows.first()).toContainText('European Club Soccer Cup')

    await region('North America')
    await expect(rows).toHaveCount(2)
    await expect(rows.nth(1)).toContainText('Northern Ice Hockey Cup')

    await region('Oceania')
    await filter('Next 7 days')
    await expect(page.getByText('No events match Oceania · Next 7 days.')).toBeVisible()
    await page.getByRole('button', { name: 'Clear filters' }).click()
    await expect(rows).toHaveCount(4)
    await expect(page.getByRole('button', { name: 'Region: All Regions' })).toBeVisible()
  })

  test('the activity chart switches period and reads out values', async ({ page }) => {
    await signInAsOrganizer(page)
    const chart = page.getByRole('img', { name: /Competitions per month/ })
    await expect(page.getByRole('table', { name: 'Competitions per month' }).getByRole('row')).toHaveCount(7)
    await page.getByLabel('Period').selectOption('12')
    await expect(page.getByRole('table', { name: 'Competitions per month' }).getByRole('row')).toHaveCount(13)
    await expect(page.getByText('vs. prior 12 months')).toBeVisible()

    await chart.focus()
    await page.keyboard.press('ArrowLeft')
    await expect(page.locator('.org-activity__tooltip')).toContainText('138')
  })

  test('search finds events and modules', async ({ page }) => {
    await signInAsOrganizer(page)
    const search = page.getByRole('combobox', { name: /Search competitions/ })
    await search.fill('cricket')
    await expect(page.getByRole('option', { name: /World Cricket Qualifier/ })).toBeVisible()
    await search.press('Enter')
    await expect(page).toHaveURL(/\/organizer\/competitions\?event=evt-wcq$/)

    await page.keyboard.press('Control+k')
    await expect(search).toBeFocused()
    await search.fill('readiness')
    await page.getByRole('option', { name: /Venues & Readiness/ }).click()
    await expect(page).toHaveURL(/\/organizer\/venues$/)
  })

  test('notifications open from the bell and close with Escape', async ({ page }) => {
    await signInAsOrganizer(page)
    const bell = page.getByRole('button', { name: 'Notifications, 1 unread' })
    await bell.click()
    const panel = page.getByRole('dialog', { name: /Notifications/ })
    await expect(panel).toContainText('Fixture change needs approval')
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

  test('switching workspace signs out and pre-selects the chosen one', async ({ page }) => {
    await page.goto('/login')
    await signIn(page, 'demo@zoikosports.test')
    await expect(page).toHaveURL(/\/organizer\/overview$/)

    await openNavigation(page)
    await page.getByRole('button', { name: 'Switch workspace' }).click()
    await page.getByRole('menuitemradio', { name: /Venue/ }).click()
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('radio', { name: 'Venue (Stadium / Arena)' })).toBeChecked()
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
