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
  await expect(page.getByRole('combobox', { name: /Search competitions, events/ })).toBeVisible()
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
    // The result opens that competition's details; close them to continue.
    await expect(page.getByRole('dialog', { name: 'World Cricket Qualifier' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)

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

test.describe('action center', () => {
  test('opens from the sidebar with its summary, lists and quick actions', async ({ page }, testInfo) => {
    await signInAsOrganizer(page)
    const nav = await openNavigation(page)
    await nav.getByRole('link', { name: /Action Center/ }).click()
    await expect(page).toHaveURL(/\/organizer\/action-center$/)
    await expect(page).toHaveTitle('Action Center · Organizer · Zoiko Sports')
    await expect(page.getByRole('heading', { level: 1, name: 'Action Center' })).toBeVisible()

    for (const [key, value] of [
      ['actions', '12'],
      ['approvals', '28'],
      ['deadlines', '6'],
      ['alerts', '3'],
    ]) {
      await expect(page.getByTestId(`summary-${key}`)).toContainText(value)
    }
    for (const heading of ['Action Queue (Prioritized)', 'Approval Requests', 'Operational Alerts', 'Upcoming Deadlines', 'Quick Actions']) {
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
    }
    await expect(page.getByTestId('action-item')).toHaveCount(5)
    await expect(page.getByTestId('action-item').first()).toContainText('Approve venue readiness')
    await expect(page.getByTestId('action-item').first()).toContainText('High')
    await expect(page.getByTestId('approval-group')).toHaveCount(5)
    await expect(page.getByTestId('deadline')).toHaveCount(3)
    await expect(page.getByRole('link', { name: 'Send Communication' })).toBeVisible()

    const nav2 = await openNavigation(page)
    await expect(nav2.getByRole('link', { name: /Action Center/ })).toHaveAttribute('aria-current', 'page')

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBe(0)
    await page.screenshot({ path: testInfo.outputPath('action-center.png'), fullPage: true })
  })

  test('"View All" expands each list in place and collapses again', async ({ page }) => {
    await signInAsOrganizer(page)
    await page.goto('/organizer/action-center')

    const queueToggle = page.getByRole('button', { name: 'View All (12)' })
    await expect(queueToggle).toHaveAttribute('aria-expanded', 'false')
    await queueToggle.click()
    await expect(page.getByTestId('action-item')).toHaveCount(12)
    await expect(page.getByRole('button', { name: 'Show less' })).toHaveAttribute('aria-expanded', 'true')
    await page.getByRole('button', { name: 'Show less' }).click()
    await expect(page.getByTestId('action-item')).toHaveCount(5)

    await page.getByRole('button', { name: 'View All (28)' }).click()
    await expect(page.getByTestId('approval-group')).toHaveCount(7)
    await page.getByRole('button', { name: 'View All (6)' }).click()
    await expect(page.getByTestId('deadline')).toHaveCount(6)
  })

  test('summary cards jump to their section and rows open the handling module', async ({ page }) => {
    await signInAsOrganizer(page)
    await page.goto('/organizer/action-center')

    await page.getByTestId('summary-deadlines').click()
    await expect(page).toHaveURL(/#ac-deadlines$/)
    await expect(page.locator('#ac-deadlines')).toBeInViewport()

    await page.getByTestId('approval-group').filter({ hasText: 'Fixture Changes' }).click()
    await expect(page).toHaveURL(/\/organizer\/fixtures\?approvals=fixture$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Fixtures & Schedule' })).toBeVisible()

    await page.goBack()
    await page.getByTestId('action-item').filter({ hasText: 'Confirm team registrations' }).click()
    await expect(page).toHaveURL(/\/organizer\/participants\?action=ac-2$/)
  })

  test('only organizers can open it', async ({ page }) => {
    await page.goto('/organizer/action-center')
    await expect(page).toHaveURL(/\/login$/)
    await signIn(page, 'venue@zoikosports.test', 'Venue (Stadium / Arena)')
    await expect(page).toHaveURL(/\/workspace$/)
  })
})

test.describe('competitions & events', () => {
  test('opens from the sidebar with its summary, directory and planning figures', async ({ page }) => {
    await signInAsOrganizer(page)
    const nav = await openNavigation(page)
    await nav.getByRole('link', { name: 'Competitions & Events' }).click()
    await expect(page).toHaveURL(/\/organizer\/competitions$/)
    await expect(page).toHaveTitle('Competitions & Events · Organizer · Zoiko Sports')
    await expect(page.getByRole('heading', { level: 1, name: 'Competitions & Events' })).toBeVisible()

    await expect(page.getByTestId('stat-active')).toContainText('142')
    await expect(page.getByTestId('stat-upcoming')).toContainText('28')
    await expect(page.getByTestId('stat-review')).toContainText('6')
    for (const [key, value] of [
      ['total', '28'],
      ['confirmed', '24'],
      ['planning', '3'],
      ['draft', '1'],
    ]) {
      await expect(page.getByTestId(`planning-${key}`)).toContainText(value)
    }
    await expect(page.getByRole('heading', { name: 'Needs Attention' })).toBeVisible()
    await expect(page.getByText('Illustrative sample data')).toBeVisible()

    const rows = page.getByTestId('competition-row')
    await expect(rows).toHaveCount(4)
    await expect(page.getByRole('navigation', { name: 'Competition pages' })).toContainText('1–4 of 8')
    await page.getByRole('button', { name: 'Next page' }).click()
    await expect(rows).toHaveCount(4)
    await expect(rows.first()).toContainText('European Club Soccer Cup')
    await expect(page.getByRole('button', { name: 'Next page' })).toBeDisabled()

    const nav2 = await openNavigation(page)
    await expect(nav2.getByRole('link', { name: 'Competitions & Events' })).toHaveAttribute('aria-current', 'page')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBe(0)
  })

  test('search and filters narrow the directory', async ({ page }) => {
    await signInAsOrganizer(page)
    await page.goto('/organizer/competitions')
    const rows = page.getByTestId('competition-row')

    await page.getByRole('searchbox', { name: 'Search competitions' }).fill('cricket')
    await expect(rows).toHaveCount(1)
    await expect(rows.first()).toContainText('World Cricket Qualifier')
    await page.getByRole('searchbox', { name: 'Search competitions' }).fill('')

    await page.getByLabel('Status', { exact: true }).selectOption('draft')
    await expect(rows).toHaveCount(1)
    await expect(rows.first()).toContainText('Copa Andina Soccer Invitational')

    // The directory's region filter is the same setting as the top bar's.
    await page.getByLabel('Region', { exact: true }).selectOption('europe')
    await expect(page.getByText('No competitions match these filters.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Region: Europe' })).toBeVisible()
    await page.getByRole('button', { name: 'Clear filters' }).click()
    await expect(rows).toHaveCount(4)
    await expect(page.getByRole('button', { name: 'Region: All Regions' })).toBeVisible()

    await page.getByLabel('Sport', { exact: true }).selectOption('basketball')
    await expect(rows).toHaveCount(2)
  })

  test('details open in a side panel, also from a link, and close with Escape', async ({ page }) => {
    await signInAsOrganizer(page)
    await page.goto('/organizer/competitions')

    await page.getByRole('button', { name: 'View details for World Cricket Qualifier' }).click()
    const panel = page.getByRole('dialog', { name: 'World Cricket Qualifier' })
    await expect(panel).toBeVisible()
    await expect(page).toHaveURL(/\?event=evt-wcq$/)
    await expect(panel.getByRole('list', { name: 'Lifecycle' }).locator('[aria-current="step"]')).toContainText('Preparing')
    await expect(panel.getByTestId('drawer-events').getByRole('listitem')).toHaveCount(4)
    await expect(panel.getByRole('link', { name: /Fixtures & Schedule/ })).toHaveAttribute('href', '/organizer/fixtures?competition=evt-wcq')
    await page.keyboard.press('Escape')
    await expect(panel).toBeHidden()
    await expect(page).toHaveURL(/\/organizer\/competitions$/)

    // Search results and other pages link straight to a competition.
    await page.goto('/organizer/competitions?event=evt-gbs')
    await expect(page.getByRole('dialog', { name: 'Global Basketball Series' })).toBeVisible()
    await page.getByRole('button', { name: 'Close details' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('creating a competition validates the form and adds it as a draft', async ({ page }) => {
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

    await expect(dialog).toBeHidden()
    await expect(page.getByRole('status').filter({ hasText: 'Harbour City Rugby Sevens created as a draft.' })).toBeAttached()
    const first = page.getByTestId('competition-row').first()
    await expect(first).toContainText('Harbour City Rugby Sevens')
    await expect(first).toContainText('Draft')
    await expect(first).toContainText('Australia')
    await expect(page.getByRole('navigation', { name: 'Competition pages' })).toContainText('of 9')
  })

  test('creating an event updates the planning summary', async ({ page }) => {
    await signInAsOrganizer(page)
    // The Overview banner's "Create Event" lands here with the form open.
    await page.getByRole('link', { name: 'Create Event' }).first().click()
    await expect(page).toHaveURL(/\/organizer\/competitions\?new=event$/)
    const dialog = page.getByRole('dialog', { name: 'Create Event' })
    await expect(dialog).toBeVisible()

    await dialog.getByLabel('Competition').selectOption({ label: 'Global Basketball Series' })
    await dialog.getByLabel('Event name').fill('All-Star Exhibition')
    await dialog.getByLabel('Venue').fill('Bayside Arena')
    await dialog.getByLabel('Date').fill('2027-01-20')
    await dialog.getByLabel('Status').selectOption('draft')
    await dialog.getByRole('button', { name: 'Create Event' }).click()
    await expect(dialog).toBeHidden()

    await expect(page.getByTestId('planning-total')).toContainText('29')
    await expect(page.getByTestId('planning-draft')).toContainText('2')
    await expect(page.getByTestId('stat-upcoming')).toContainText('29')

    await page.getByRole('button', { name: 'View details for Global Basketball Series' }).click()
    const panel = page.getByRole('dialog', { name: 'Global Basketball Series' })
    await expect(panel.getByTestId('drawer-events')).toContainText('All-Star Exhibition')
    await expect(panel).toContainText('Event added – All-Star Exhibition')
  })

  test('the Overview quick action "Create Competition" opens the form', async ({ page }) => {
    await signInAsOrganizer(page)
    await page.getByRole('link', { name: 'Create Competition' }).click()
    await expect(page).toHaveURL(/\/organizer\/competitions\?new=competition$/)
    await expect(page.getByRole('dialog', { name: 'Create Competition' })).toBeVisible()
  })
})

test.describe('fixtures & schedule', () => {
  const rows = (page: Page) => page.getByTestId('fixture-row')
  const openFixture = async (page: Page, name: string) => {
    await page.getByRole('button', { name: `Open ${name}` }).click()
    const panel = page.getByRole('dialog', { name })
    await expect(panel).toBeVisible()
    return panel
  }

  test('opens from the sidebar with summary, list, calendar and conflicts', async ({ page }) => {
    await signInAsOrganizer(page)
    const nav = await openNavigation(page)
    await nav.getByRole('link', { name: 'Fixtures & Schedule' }).click()
    await expect(page).toHaveURL(/\/organizer\/fixtures$/)
    await expect(page).toHaveTitle('Fixtures & Schedule · Organizer · Zoiko Sports')
    await expect(page.getByRole('heading', { level: 1, name: 'Fixtures & Schedule' })).toBeVisible()

    for (const [key, value] of [
      ['total', '312'],
      ['confirmed', '276'],
      ['pending', '28'],
      ['conflicts', '8'],
    ]) {
      await expect(page.getByTestId(`fx-stat-${key}`)).toContainText(value)
    }
    await expect(rows(page)).toHaveCount(5)
    await expect(rows(page).first()).toContainText('Riverside Hawks vs. Lakeside Titans')
    await expect(rows(page).first()).toContainText(/PST/)
    await page.getByRole('button', { name: 'View full schedule' }).click()
    await expect(rows(page)).toHaveCount(11)

    await expect(page.getByRole('heading', { name: 'Schedule Calendar' })).toBeVisible()
    await expect(page.getByRole('list', { name: 'Legend' })).toContainText('Key Matches')
    await expect(page.getByRole('heading', { name: 'Conflicts to Review' })).toBeVisible()
    await expect(page.getByText('Sample data is illustrative')).toBeVisible()

    const nav2 = await openNavigation(page)
    await expect(nav2.getByRole('link', { name: 'Fixtures & Schedule' })).toHaveAttribute('aria-current', 'page')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBe(0)
  })

  test('period, sport and region filters and calendar days narrow the list', async ({ page }) => {
    await signInAsOrganizer(page)
    await page.goto('/organizer/fixtures')

    await page.getByLabel('Sport', { exact: true }).selectOption('basketball')
    await expect(rows(page)).toHaveCount(3)
    await page.getByLabel('Period', { exact: true }).selectOption('all')
    await expect(rows(page)).toHaveCount(4)
    await page.getByLabel('Sport', { exact: true }).selectOption('all')
    await page.getByLabel('Region', { exact: true }).selectOption('oceania')
    await expect(rows(page)).toHaveCount(2)
    await expect(page.getByRole('button', { name: 'Region: Oceania' })).toBeVisible()
    await page.getByLabel('Region', { exact: true }).selectOption('all')

    // Choosing a day on the calendar shows that day's fixtures; the chip clears it.
    const day = page.locator('.org-calendar__day.has-fixtures').first()
    await day.click()
    await expect(day).toHaveAttribute('aria-pressed', 'true')
    const chip = page.getByRole('button', { name: /^Showing on/ })
    await expect(chip).toBeVisible()
    const count = await rows(page).count()
    expect(count).toBeGreaterThan(0)
    await chip.click()
    await expect(chip).toHaveCount(0)
  })

  test('conflicts: "View all" filters the list and Review opens the fixture', async ({ page }) => {
    await signInAsOrganizer(page)
    await page.goto('/organizer/fixtures')
    await page.getByRole('button', { name: 'View all 8' }).click()
    await expect(rows(page)).toHaveCount(2)
    for (const status of await rows(page).locator('.org-status').allTextContents()) expect(status).toBe('Conflict')

    await page.getByRole('button', { name: 'Review: Venue schedule overlap' }).click()
    const panel = page.getByRole('dialog', { name: 'Northbridge CC vs. Saltmarsh CC' })
    await expect(panel.getByRole('note')).toContainText('Schedule conflict.')
  })

  test('a change goes from proposal to approval to a published version', async ({ page }) => {
    await signInAsOrganizer(page)
    await page.goto('/organizer/fixtures')
    await page.getByRole('button', { name: 'View full schedule' }).click()

    const panel = await openFixture(page, 'Emerald CC vs. Ridgeway CC')
    await expect(panel.getByRole('heading', { name: 'Proposed change · v2' })).toBeVisible()
    await expect(panel.getByRole('table', { name: 'Published and proposed versions' })).toContainText('Published v1')

    await panel.getByRole('button', { name: 'Request approval' }).click()
    await expect(panel).toContainText('Awaiting approval')
    await expect(panel.getByText('Publishing sends the new version to:')).toBeVisible()
    await expect(panel.getByText('Assigned match officials (3)')).toBeVisible()

    // Publication needs an explicit reason.
    await panel.getByLabel('Reason recorded with the publication').fill('')
    await panel.getByRole('button', { name: 'Approve & publish v2' }).click()
    await expect(panel.getByRole('alert')).toContainText('Give a reason for publishing this change.')
    await panel.getByLabel('Reason recorded with the publication').fill('Approved: earlier start for weather.')
    await panel.getByRole('button', { name: 'Approve & publish v2' }).click()

    await expect(panel.getByTestId('fixture-history').getByRole('listitem')).toHaveCount(2)
    await expect(panel.getByTestId('fixture-history').getByRole('listitem').first()).toContainText('v2')
    await expect(panel.getByRole('button', { name: /Propose change/ })).toBeVisible()
    await page.keyboard.press('Escape')

    await expect(page.getByTestId('fx-stat-pending')).toContainText('27')
    await expect(page.getByTestId('fx-stat-confirmed')).toContainText('277')
    await expect(rows(page).filter({ hasText: 'Emerald CC vs. Ridgeway CC' }).locator('.org-status')).toHaveText('Confirmed')
  })

  test('proposing a change requires a reason and marks the fixture pending', async ({ page }) => {
    await signInAsOrganizer(page)
    await page.goto('/organizer/fixtures')
    const panel = await openFixture(page, 'Harbor Kings vs. Desert Suns')
    await panel.getByRole('button', { name: /Propose change/ }).click()
    await expect(panel.getByLabel('Reason for the change')).toBeFocused()
    await panel.getByLabel(/^Local time/).fill('20:30')
    await panel.getByRole('button', { name: 'Save proposal' }).click()
    await expect(panel.getByRole('alert')).toContainText('Give a reason for the change.')
    await panel.getByLabel('Reason for the change').fill('Venue lighting test moved.')
    await panel.getByRole('button', { name: 'Save proposal' }).click()

    await expect(panel.getByRole('heading', { name: 'Proposed change · v2' })).toBeVisible()
    await expect(panel.locator('.org-compare .is-changed')).toContainText('8:30 PM')
    await page.keyboard.press('Escape')
    await expect(rows(page).filter({ hasText: 'Harbor Kings vs. Desert Suns' }).locator('.org-status')).toHaveText('Pending')
    await expect(page.getByTestId('fx-stat-pending')).toContainText('29')
  })

  test('a new fixture is created as a draft and can be discarded', async ({ page }) => {
    await signInAsOrganizer(page)
    await page.goto('/organizer/fixtures')
    await page.getByRole('link', { name: 'Create Fixture' }).click()
    const dialog = page.getByRole('dialog', { name: 'Create Fixture' })
    await expect(dialog.getByLabel('Home')).toBeFocused()
    await dialog.getByRole('button', { name: 'Create Draft Fixture' }).click()
    await expect(dialog.getByText('Enter the home team or player.')).toBeVisible()

    await dialog.getByLabel('Competition').selectOption({ label: 'Global Basketball Series' })
    await dialog.getByLabel('Home').fill('Northern Owls')
    await dialog.getByLabel('Away').fill('Southern Foxes')
    await dialog.getByLabel('Local date').fill('2027-01-15')
    await dialog.getByLabel('Local time').fill('19:30')
    await dialog.getByRole('button', { name: 'Create Draft Fixture' }).click()

    const panel = page.getByRole('dialog', { name: 'Northern Owls vs. Southern Foxes' })
    await expect(panel.getByRole('heading', { name: 'New fixture · v1' })).toBeVisible()
    await expect(panel).toContainText('7:30 PM JST')
    await expect(page.getByTestId('fx-stat-total')).toContainText('313')
    await panel.getByRole('button', { name: 'Discard fixture' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByTestId('fx-stat-total')).toContainText('312')
  })

  test('links from other pages arrive filtered', async ({ page }) => {
    await signInAsOrganizer(page)
    // Competitions & Events details → "Fixtures & Schedule"
    await page.goto('/organizer/fixtures?competition=evt-wcq')
    await expect(page.getByRole('button', { name: /^Showing World Cricket Qualifier/ })).toBeVisible()
    await expect(rows(page)).toHaveCount(3)
    for (const text of await rows(page).allTextContents()) expect(text).toContain('World Cricket Qualifier')

    // Action Center → Fixture Changes approvals
    await page.goto('/organizer/fixtures?approvals=fixture')
    await expect(rows(page)).toHaveCount(2)
    for (const status of await rows(page).locator('.org-status').allTextContents()) expect(status).toBe('Pending')
  })

  test('import and calendar sync explain they are not available yet', async ({ page }) => {
    await signInAsOrganizer(page)
    await page.goto('/organizer/fixtures')
    await page.getByRole('button', { name: 'Import Schedule' }).click()
    await expect(page.getByRole('dialog', { name: 'Import Schedule' })).toContainText("isn't available yet")
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Sync Calendar' }).click()
    await expect(page.getByRole('dialog', { name: 'Sync Calendar' })).toContainText("isn't available yet")
  })
})
