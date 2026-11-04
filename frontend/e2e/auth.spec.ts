import { expect, test, type Page } from '@playwright/test'
import { linkFromEmail } from './mail'

// Random per run (playwright.config.ts) and seeded into the throwaway backend.
const DEMO_PASSWORD = process.env.E2E_DEMO_PASSWORD!
const NEW_PASSWORD = 'Fresh-Pitch-2026!'

const WORKSPACES = [
  { radio: 'Organization (League / Event)', label: 'Organization', organization: 'Riverside Invitational' },
  { radio: 'Venue (Stadium / Arena)', label: 'Venue', organization: 'Northfield Arena' },
  { radio: 'Team / Club (Sports Team)', label: 'Team / Club', organization: 'Club A' },
  { radio: 'Individual (Participant / Staff)', label: 'Individual', organization: null },
]

async function signIn(page: Page, email: string, password: string, workspace: string) {
  await page.getByRole('radio', { name: workspace }).check()
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign In', exact: true }).click()
}

const uniqueEmail = (prefix: string) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`

test.describe('sign in to each of the four workspaces', () => {
  for (const workspace of WORKSPACES) {
    test(workspace.label, async ({ page }) => {
      await page.goto('/login')
      await signIn(page, 'demo@zoikosports.test', DEMO_PASSWORD, workspace.radio)

      await expect(page).toHaveURL(/\/workspace$/)
      await expect(page.getByTestId('workspace-type')).toHaveText(workspace.label)
      if (workspace.organization) {
        await expect(page.getByTestId('workspace-organization')).toHaveText(workspace.organization)
      } else {
        await expect(page.getByTestId('workspace-organization')).toHaveCount(0)
      }

      // The session survives a reload (cookie-based) and sign-out ends it.
      await page.reload()
      await expect(page.getByTestId('workspace-type')).toHaveText(workspace.label)
      await page.getByRole('button', { name: 'Sign out' }).click()
      await expect(page).toHaveURL(/\/login$/)
      await page.goto('/workspace')
      await expect(page).toHaveURL(/\/login$/)
    })
  }
})

test.describe('sign-in errors', () => {
  test('wrong workspace offers the ones the account has', async ({ page }) => {
    await page.goto('/login')
    await signIn(page, 'club@zoikosports.test', DEMO_PASSWORD, 'Venue (Stadium / Arena)')

    const alert = page.getByRole('alert')
    await expect(alert).toContainText("doesn't have access to a Venue workspace")
    await alert.getByRole('button', { name: 'Use Team / Club' }).click()
    await expect(page.getByRole('radio', { name: 'Team / Club (Sports Team)' })).toBeChecked()
    await page.getByRole('button', { name: 'Sign In', exact: true }).click()
    await expect(page.getByTestId('workspace-organization')).toHaveText('Club A')
  })

  test('invalid credentials are reported without revealing which part was wrong', async ({ page }) => {
    await page.goto('/login')
    await signIn(page, 'demo@zoikosports.test', 'not-the-password', 'Individual (Participant / Staff)')
    await expect(page.getByRole('alert')).toHaveText('Incorrect email or password.')
    await expect(page.getByLabel('Password', { exact: true })).toHaveValue('')
    await expect(page.getByRole('alert')).toBeFocused()
  })

  test('client-side validation runs before contacting the server', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: 'Sign In', exact: true }).click()
    await expect(page.getByText('Enter a valid email address.')).toBeVisible()
    await expect(page.getByText('Enter your password.')).toBeVisible()
    await expect(page.getByLabel('Email address')).toHaveAttribute('aria-invalid', 'true')
  })

  test('unverified accounts are told to verify', async ({ page }) => {
    const email = uniqueEmail('unverified')
    await page.goto('/register')
    await page.getByLabel('Full name').fill('Una Verified')
    await page.getByLabel('Email address').fill(email)
    await page.getByLabel('Password', { exact: true }).fill(NEW_PASSWORD)
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible()

    await page.goto('/login')
    await signIn(page, email, NEW_PASSWORD, 'Individual (Participant / Staff)')
    await expect(page.getByRole('alert')).toContainText('verify your email')
    await page.getByRole('button', { name: 'Resend verification email' }).click()
    await expect(page.getByRole('status')).toContainText("we've sent a new link")
  })
})

test.describe('login page controls', () => {
  test('account types are a keyboard-operable radio group, remembered across visits', async ({ page }) => {
    await page.goto('/login')
    const organization = page.getByRole('radio', { name: 'Organization (League / Event)' })
    await organization.check()
    await organization.focus()
    await page.keyboard.press('ArrowRight')
    await expect(page.getByRole('radio', { name: 'Venue (Stadium / Arena)' })).toBeChecked()
    await page.reload()
    await expect(page.getByRole('radio', { name: 'Venue (Stadium / Arena)' })).toBeChecked()
  })

  test('password visibility toggle', async ({ page }) => {
    await page.goto('/login')
    const password = page.getByLabel('Password', { exact: true })
    await password.fill('secret-value')
    await expect(password).toHaveAttribute('type', 'password')
    await page.getByRole('button', { name: 'Show password' }).click()
    await expect(password).toHaveAttribute('type', 'text')
    await page.getByRole('button', { name: 'Hide password' }).click()
    await expect(password).toHaveAttribute('type', 'password')
  })

  test('federated and passkey options explain they are not yet available', async ({ page }) => {
    await page.goto('/login')
    for (const name of ['Google', 'Microsoft', 'Apple', 'Company SSO']) {
      await page.getByRole('button', { name: `${name} sign-in — not yet available` }).click()
      await expect(page.getByRole('status')).toContainText(`Sign-in with ${name} isn't available yet`)
    }
    await page.getByRole('button', { name: /Use a passkey/ }).click()
    await expect(page.getByRole('status')).toContainText("Passkey sign-in isn't available yet")
  })

  test('signed-in visitors are sent to their workspace; deep links return after sign-in', async ({ page }) => {
    await page.goto('/workspace')
    await expect(page).toHaveURL(/\/login$/)
    await signIn(page, 'venue@zoikosports.test', DEMO_PASSWORD, 'Venue (Stadium / Arena)')
    await expect(page).toHaveURL(/\/workspace$/)
    await page.goto('/login')
    await expect(page).toHaveURL(/\/workspace$/)
  })
})

test.describe('account lifecycle', () => {
  test('register, verify by email link, then sign in as Individual', async ({ page }) => {
    const email = uniqueEmail('new')
    await page.goto('/login')
    await page.getByRole('link', { name: 'Create an account' }).click()
    await page.getByLabel('Full name').fill('Nia New')
    await page.getByLabel('Email address').fill(email)
    await page.getByLabel('Password', { exact: true }).fill(NEW_PASSWORD)
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page.getByText(`We've sent a verification link to ${email}`)).toBeVisible()

    await page.goto(await linkFromEmail(email, '/verify-email'))
    await expect(page.getByRole('heading', { name: 'Email verified' })).toBeVisible()
    await page.getByRole('link', { name: 'Go to sign in' }).click()

    await signIn(page, email, NEW_PASSWORD, 'Individual (Participant / Staff)')
    await expect(page.getByTestId('workspace-type')).toHaveText('Individual')
  })

  test('weak passwords are rejected by the server with a field message', async ({ page }) => {
    await page.goto('/register')
    await page.getByLabel('Full name').fill('Wes Weak')
    await page.getByLabel('Email address').fill(uniqueEmail('weak'))
    await page.getByLabel('Password', { exact: true }).fill('1234567890')
    await page.getByRole('button', { name: 'Create account' }).click()
    // Django's validators flag it (too common / entirely numeric / too similar to the email).
    await expect(page.locator('.field__error')).toHaveText(/password is (too common|entirely numeric|too similar)/)
    await expect(page.getByRole('alert')).toHaveText('Please correct the highlighted fields.')
  })

  test('forgot password, reset by email link, then sign in with the new password', async ({ page }) => {
    // Use a fresh verified account so the shared demo logins are never changed.
    const email = uniqueEmail('reset')
    await page.goto('/register')
    await page.getByLabel('Full name').fill('Rae Reset')
    await page.getByLabel('Email address').fill(email)
    await page.getByLabel('Password', { exact: true }).fill(NEW_PASSWORD)
    await page.getByRole('button', { name: 'Create account' }).click()
    await page.goto(await linkFromEmail(email, '/verify-email'))
    await expect(page.getByRole('heading', { name: 'Email verified' })).toBeVisible()

    await page.goto('/login')
    await page.getByRole('link', { name: 'Forgot password?' }).click()
    await page.getByLabel('Email address').fill(email)
    await page.getByRole('button', { name: 'Send reset link' }).click()
    await expect(page.getByRole('status')).toContainText("If an account exists for that email, we've sent a link")

    const resetLink = await linkFromEmail(email, '/reset-password')
    await page.goto(resetLink)
    await page.getByLabel('New password', { exact: true }).fill('Second-Half-2026!')
    await page.getByLabel('Confirm new password').fill('Second-Half-2026!')
    await page.getByRole('button', { name: 'Update password' }).click()
    await expect(page.getByRole('heading', { name: 'Password updated' })).toBeVisible()

    // The link is single-use.
    await page.goto(resetLink)
    await page.getByLabel('New password', { exact: true }).fill('Third-Half-2026!')
    await page.getByLabel('Confirm new password').fill('Third-Half-2026!')
    await page.getByRole('button', { name: 'Update password' }).click()
    await expect(page.getByRole('alert')).toContainText('invalid or has expired')

    await page.goto('/login')
    await signIn(page, email, 'Second-Half-2026!', 'Individual (Participant / Staff)')
    await expect(page.getByTestId('workspace-type')).toHaveText('Individual')
  })
})

test.describe('responsive layout', () => {
  test('no horizontal scrolling, brand and all four options visible', async ({ page }, testInfo) => {
    await page.goto('/login')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBe(0)

    await expect(page.getByRole('img', { name: 'Zoiko Sports — Global Sports Platform' })).toBeVisible()
    await expect(page.getByRole('img', { name: 'Zoiko Sports', exact: true })).toBeVisible()
    for (const { radio } of WORKSPACES) {
      const tile = page.locator('label.account-type', { has: page.getByRole('radio', { name: radio }) })
      await tile.scrollIntoViewIfNeeded()
      await expect(tile).toBeInViewport({ ratio: 1 })
    }

    const isDesktop = testInfo.project.name === 'desktop'
    // Desktop draws the stadium plate behind the artboard; smaller screens frame the
    // athletes in the in-flow stage and the plate resolves to a 1×1 placeholder, so
    // the large artwork is never downloaded on phones.
    const plate = page.locator('.auth-plate')
    await expect
      .poll(() => plate.evaluate((img: HTMLImageElement) => img.complete && img.currentSrc))
      .toMatch(isDesktop ? /stadium-wide(-1360)?.*\.(webp|jpg)/ : /^data:image\/gif/)
    await expect(page.locator('.auth-stage')).toBeVisible({ visible: !isDesktop })
    await page.screenshot({ path: testInfo.outputPath('login.png'), fullPage: true })
  })
})

test.describe('reference layout (desktop)', () => {
  // Boxes measured on the 1600×900 reference design (Login Page.jpeg): [x, top, right, bottom].
  const REFERENCE: Record<string, [number, number, number, number]> = {
    '.auth-card': [975, 68, 1507, 776],
    '.auth-intro__logo': [62, 27, 421, 157],
    '.auth-intro__headline': [62, 177, 422, 315],
    '.auth-features': [62, 462, 312, 706],
    '.account-types': [998, 236, 1484, 311],
    '.auth-form__submit': [1008, 498, 1474, 542],
    '.social__passkey': [1008, 658, 1474, 710],
  }
  // In reference px. Font sizes round to whole device pixels, so scaled
  // viewports drift slightly more than the 1:1 design (±3px at 1600×900).
  const TOLERANCE = 6

  for (const viewport of [
    { width: 1600, height: 900, scale: 1 },
    { width: 1920, height: 1080, scale: 1.2 },
    { width: 1280, height: 720, scale: 0.8 },
  ]) {
    test(`matches the reference geometry at ${viewport.width}×${viewport.height}`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'desktop', 'desktop artboard only')
      await page.setViewportSize(viewport)
      await page.goto('/login')
      await page.evaluate(() => document.fonts.ready)
      for (const [selector, [x, top, right, bottom]] of Object.entries(REFERENCE)) {
        const box = (await page.locator(selector).first().boundingBox())!
        const s = viewport.scale
        const actual = [box.x, box.y, box.x + box.width, box.y + box.height].map((v) => v / s)
        actual.forEach((value, i) =>
          expect(Math.abs(value - [x, top, right, bottom][i]), `${selector} edge ${i}: ${value.toFixed(1)}`).toBeLessThanOrEqual(TOLERANCE),
        )
      }
      // The whole composition fits: nothing scrolls.
      expect(await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)).toBeLessThanOrEqual(0)
    })
  }

  test('nothing shifts while the page loads (cumulative layout shift)', async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __cls: number }
      w.__cls = 0
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) {
          if (!entry.hadRecentInput) w.__cls += entry.value
        }
      }).observe({ type: 'layout-shift', buffered: true })
    })
    await page.goto('/login')
    await page.locator('.auth-card').waitFor()
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(1500) // session/config requests and image decoding settle
    const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls)
    // Google's "good" threshold is 0.1; the sign-in screen should be essentially static.
    expect(cls).toBeLessThan(0.05)
  })

  for (const viewport of [
    { width: 1850, height: 958 }, // 1920×1080 screen minus browser chrome
    { width: 2560, height: 1080 }, // 21:9
  ]) {
    test(`wider than 16:9 keeps the reference edge margins at ${viewport.width}×${viewport.height}`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'desktop', 'desktop artboard only')
      await page.setViewportSize(viewport)
      await page.goto('/login')
      await page.evaluate(() => document.fonts.ready)
      const u = viewport.height / 900 // height-limited on wide screens
      const [logo, card, board] = await Promise.all(
        ['.auth-intro__logo', '.auth-card', '.auth-board'].map((s) => page.locator(s).boundingBox()),
      )
      // Brand column 62 from the left edge, card 93 from the right, card top 68 — as in the reference.
      expect(Math.abs(logo!.x / u - 62)).toBeLessThanOrEqual(2)
      expect(Math.abs((viewport.width - card!.x - card!.width) / u - 93)).toBeLessThanOrEqual(2)
      expect(Math.abs(card!.y / u - 68)).toBeLessThanOrEqual(2)
      // The board spans the whole width: no side bands where the shading or artwork stops.
      expect(board!.x).toBeLessThanOrEqual(0)
      expect(board!.x + board!.width).toBeGreaterThanOrEqual(viewport.width)
    })
  }

  test('the layout stays put while scrolling a short window', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop artboard only')
    // Shorter than the artboard's minimum scale: the page scrolls, and the
    // background must move with the content (no parallax drift under the card).
    await page.setViewportSize({ width: 1400, height: 560 })
    await page.goto('/login')
    const gap = async () => {
      const [card, plate] = await Promise.all([page.locator('.auth-card').boundingBox(), page.locator('.auth-plate').boundingBox()])
      return { dx: card!.x - plate!.x, dy: card!.y - plate!.y }
    }
    const before = await gap()
    await page.mouse.wheel(0, 400)
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0)
    expect(await gap()).toEqual(before)
  })
})

test.describe('theme follows the system preference', () => {
  const cardBackground = (page: Page) =>
    page.locator('.auth-card').evaluate((el) => getComputedStyle(el).backgroundImage)
  const wordmarkSource = (page: Page) =>
    page.getByRole('img', { name: 'Zoiko Sports', exact: true }).evaluate((el) => getComputedStyle(el).backgroundImage)
  const titleColor = (page: Page) =>
    page.getByRole('heading', { name: 'Welcome back' }).evaluate((el) => getComputedStyle(el).color)

  test('light system theme shows the reference light card', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/login')
    expect(await cardBackground(page)).toContain('rgba(255, 255, 255, 0.97)')
    expect(await titleColor(page)).toBe('rgb(17, 19, 46)')
    await expect.poll(() => wordmarkSource(page)).toContain('logo-wordmark-ink')
  })

  test('dark system theme shows the dark card', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/login')
    expect(await cardBackground(page)).toContain('rgba(14, 22, 64, 0.86)')
    expect(await titleColor(page)).toBe('rgb(255, 255, 255)')
    await expect.poll(() => wordmarkSource(page)).not.toContain('logo-wordmark-ink')
  })

  test('switching the system theme restyles the page live, without a reload', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/login')
    // Typed input must survive the switch, proving there was no reload.
    await page.getByLabel('Email address').fill('still-here@example.com')
    await page.evaluate(() => ((window as unknown as { __marker: boolean }).__marker = true))

    await page.emulateMedia({ colorScheme: 'dark' })
    await expect.poll(() => titleColor(page)).toBe('rgb(255, 255, 255)')
    await expect.poll(() => wordmarkSource(page)).not.toContain('logo-wordmark-ink')

    await page.emulateMedia({ colorScheme: 'light' })
    await expect.poll(() => titleColor(page)).toBe('rgb(17, 19, 46)')
    await expect.poll(() => wordmarkSource(page)).toContain('logo-wordmark-ink')

    await expect(page.getByLabel('Email address')).toHaveValue('still-here@example.com')
    expect(await page.evaluate(() => (window as unknown as { __marker?: boolean }).__marker)).toBe(true)
  })
})

test.describe('theme toggle', () => {
  const theme = (page: Page) => page.evaluate(() => document.documentElement.dataset.theme)
  const option = (page: Page, name: string) => page.getByRole('radio', { name })

  test('starts on "system" and offers Light, System and Dark', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/login')
    await expect(option(page, 'Match system theme')).toBeChecked()
    expect(await theme(page)).toBe('dark')
    await expect(option(page, 'Light theme')).toBeVisible()
    await expect(option(page, 'Dark theme')).toBeVisible()
  })

  test('a manual choice overrides the system theme and persists across reloads', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/login')
    await option(page, 'Dark theme').check()
    await expect.poll(() => theme(page)).toBe('dark')

    await page.reload()
    await expect(option(page, 'Dark theme')).toBeChecked()
    expect(await theme(page)).toBe('dark')

    // The system changing does not override a manual choice.
    await page.emulateMedia({ colorScheme: 'light' })
    await page.waitForTimeout(300)
    expect(await theme(page)).toBe('dark')
  })

  test('"system" follows the operating system again, live', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/login')
    await option(page, 'Dark theme').check()
    await option(page, 'Match system theme').check()
    await expect.poll(() => theme(page)).toBe('light')
    expect(await page.evaluate(() => localStorage.getItem('zs.theme'))).toBeNull()

    await page.emulateMedia({ colorScheme: 'dark' })
    await expect.poll(() => theme(page)).toBe('dark')
  })

  test('the theme is applied before first paint (no flash)', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('zs.theme', 'dark'))
    await page.emulateMedia({ colorScheme: 'light' })
    // Block the app bundle entirely: only the inline <head> script can set the
    // theme, proving it is applied before any app code (and before first paint).
    await page.route(/\/assets\/.*\.js$/, (route) => route.abort())
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    expect(await page.evaluate(() => document.getElementById('root')!.childElementCount)).toBe(0)
    expect(await theme(page)).toBe('dark')
  })

  test('keyboard: arrow keys move between options', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/login')
    await option(page, 'Match system theme').focus()
    await page.keyboard.press('ArrowRight')
    await expect(option(page, 'Dark theme')).toBeChecked()
    await expect.poll(() => theme(page)).toBe('dark')
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('ArrowLeft')
    await expect(option(page, 'Light theme')).toBeChecked()
    await expect.poll(() => theme(page)).toBe('light')
  })
})
