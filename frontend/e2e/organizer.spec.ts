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
    await expect(page.getByRole('link', { name: 'View Global Calendar' })).toBeVisible()

    for (const [id, value] of [
      ['active-competitions', '142'],
      ['live-events', '18'],
      ['participating-organizations', '2,847'],
      ['countries-regions', '196'],
    ]) {
      await expect(page.getByTestId(`kpi-${id}`)).toContainText(value)
    }

    for (const heading of ['Upcoming Events & Fixtures', 'Global Participation', 'Recent Decisions & Updates', 'Quick Actions']) {
      await expect(page.getByRole('heading', { name: heading })).toBeVisible()
    }
    await expect(page.getByTestId('upcoming-event')).toHaveCount(4)
    await expect(page.getByRole('img', { name: /Share of participating organizations by region/ })).toBeVisible()
    await expect(page.getByRole('list', { name: 'Participation by region' }).getByRole('listitem')).toHaveCount(6)

    // The signed-in identity comes from the session, not from mock data.
    await expect(page.getByRole('button', { name: 'Account: Olivia Organizer' })).toBeVisible()
    if (testInfo.project.name === 'desktop') {
      await expect(page.getByTestId('organizer-user-name')).toHaveText('Olivia Organizer')
      await expect(page.getByText('Competition Director', { exact: true })).toBeVisible()
    }

    const nav = await openNavigation(page)
    await expect(nav.getByRole('link', { name: /01\. Overview/ })).toHaveAttribute('aria-current', 'page')
    await expect(nav.getByRole('link', { name: /02\. Action Center/ })).toContainText('6')
    await expect(nav.getByRole('link', { name: /16\. Internal Administration/ })).toBeVisible()

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
    await nav.getByRole('link', { name: /04\. Fixtures & Schedule/ }).click()
    await expect(page).toHaveURL(/\/organizer\/fixtures$/)
    await expect(page.getByRole('heading', { level: 1, name: /Fixtures & Schedule/ })).toBeVisible()
    await expect(page).toHaveTitle('Fixtures & Schedule · Organizer · Zoiko Sports')

    nav = await openNavigation(page)
    await expect(nav.getByRole('link', { name: /04\. Fixtures & Schedule/ })).toHaveAttribute('aria-current', 'page')
    await nav.getByRole('link', { name: /14\. Venue Operations/ }).click()
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

    await page.getByLabel('Sport').selectOption('cricket')
    await expect(rows).toHaveCount(1)
    await expect(rows.first()).toContainText('World Cricket Qualifier')
    await page.getByLabel('Sport').selectOption('all')

    // The top-bar region scope and the card's region filter are one setting.
    await page.getByRole('button', { name: 'Region: All Regions' }).click()
    await page.getByRole('menuitemradio', { name: 'Europe' }).click()
    await expect(page.getByLabel('Region', { exact: true })).toHaveValue('europe')
    await expect(rows).toHaveCount(1)
    await expect(rows.first()).toContainText('European Club Soccer Cup')

    await page.getByLabel('Region', { exact: true }).selectOption('north-america')
    await expect(rows).toHaveCount(1)
    await page.getByLabel('Date range').selectOption('90')
    await expect(rows).toHaveCount(2)
    await expect(rows.nth(1)).toContainText('Northern Ice Hockey Cup')

    await page.getByLabel('Region', { exact: true }).selectOption('oceania')
    await page.getByLabel('Date range').selectOption('7')
    await expect(page.getByText('No events match these filters in this period.')).toBeVisible()
    await page.getByRole('button', { name: 'Clear filters' }).click()
    await expect(rows).not.toHaveCount(0)
  })

  test('search finds events and modules', async ({ page }) => {
    await signInAsOrganizer(page)
    const search = page.getByRole('combobox', { name: /Search events/ })
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
    const bell = page.getByRole('button', { name: 'Notifications, 3 unread' })
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
    const cardBackground = () =>
      page.getByTestId('kpi-live-events').evaluate((el) => getComputedStyle(el).backgroundColor)
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

    await page.getByRole('button', { name: 'Workspace: Organizer' }).click()
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
