import { expect, test, type Page } from '@playwright/test'

// Random per run (playwright.config.ts) and seeded into the throwaway backend.
const DEMO_PASSWORD = process.env.E2E_DEMO_PASSWORD!
const ORGANIZATION = 'Organization (League / Event)'

// No organizer data endpoint exists yet (features/organizer/api/endpoints.ts),
// so every page renders its layout with unknown figures and empty lists.
const NOT_CONNECTED = "Live data isn't connected yet."
const NOT_AVAILABLE_ACTION = "isn't available yet"

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

/** A figure the server has not provided reads "—", never an invented number. */
async function expectUnknown(page: Page, testId: string) {
  const card = page.getByTestId(testId)
  await expect(card).toContainText('—')
  await expect(card).toContainText('Not available')
  await expect(card).not.toContainText(/\d/)
}

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
      await expect(page.getByText('Competition Director', { exact: true })).toBeVisible()
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
