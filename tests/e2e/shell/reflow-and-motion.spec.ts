// T144: reflow, orientation, focus visibility and motion on every screen and dialog of feature 001
// (FR-080, FR-083, FR-085, SC-005, WCAG 1.4.10, 2.4.11).
import type { Page } from '@playwright/test'

import { fixedKeyId } from '../../mocks/scenarios/api-keys'
import type { ScenarioOverrides } from '../../mocks/scenarios'
import { expect, test } from '../fixtures/test'
import { isNarrow } from '../fixtures/flows'

interface Screen {
  name: string
  scenario: string
  overrides?: ScenarioOverrides
  path: string
  /** Opens a dialog or menu on the screen; returns the locator that must be visible. */
  open?: (page: Page) => Promise<void>
}

const pending = {
  session: {
    state: 'pendingSecondFactor' as const,
    username: 'alice@example.org',
    pendingSignIn: {
      username: 'alice@example.org',
      role: null,
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    },
  },
}

const SCREENS: Screen[] = [
  { name: 'the sign-in screen', scenario: 'anonymous-default', path: 'sign-in' },
  { name: 'a role sign-in screen', scenario: 'idp-configured', path: 'sign-in/admin' },
  {
    name: 'the second-factor step',
    scenario: 'mailbox-all-factors',
    overrides: pending,
    path: 'sign-in/second-factor',
  },
  { name: 'the pending actions', scenario: 'forced-both', path: '' },
  { name: 'home', scenario: 'domain-admin-two-domains', path: '' },
  { name: 'a placeholder', scenario: 'admin-active', path: 'routing' },
  { name: '"no access"', scenario: 'domain-admin-two-domains', path: 'api-keys' },
  { name: '"not found"', scenario: 'admin-active', path: 'no/such/page' },
  { name: 'the passkeys', scenario: 'user-with-passkeys', path: 'passkeys' },
  {
    name: 'the rename dialog',
    scenario: 'user-with-passkeys',
    path: 'passkeys',
    open: (page) =>
      page
        .getByRole('main')
        .getByRole('button', { name: /^Rename/ })
        .first()
        .click(),
  },
  {
    name: 'the removal confirmation',
    scenario: 'user-with-passkeys',
    path: 'passkeys',
    open: (page) =>
      page
        .getByRole('main')
        .getByRole('button', { name: /^Remove/ })
        .first()
        .click(),
  },
  { name: 'the API keys', scenario: 'api-keys-many', path: 'api-keys' },
  { name: 'the API key form', scenario: 'api-keys-empty', path: 'api-keys/new' },
  { name: 'an API key', scenario: 'api-keys-many', path: `api-keys/${fixedKeyId(1)}` },
  { name: 'the audit log', scenario: 'audit-records', path: 'audit-log' },
  {
    name: 'the user menu',
    scenario: 'admin-active',
    path: '',
    open: (page) => page.getByRole('button', { name: 'Account menu of admin' }).click(),
  },
  {
    name: 'the apps menu',
    scenario: 'app-links-webmail-and-two',
    path: '',
    open: (page) => page.getByRole('button', { name: 'Our services menu' }).click(),
  },
]

async function openScreen(
  page: Page,
  screen: Screen,
  mockApi: { use: (n: string, o?: ScenarioOverrides) => Promise<string> },
) {
  await mockApi.use(screen.scenario, screen.overrides)
  await page.goto(screen.path)
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
  if (screen.open) {
    await screen.open(page)
    await expect(page.locator('[role="dialog"], [role="alertdialog"], [role="menu"]')).toBeVisible()
  }
}

/** The longest transition or animation on the page, in seconds. */
async function longestMotion(page: Page): Promise<number> {
  return page.evaluate(() => {
    const seconds = (value: string) =>
      Math.max(
        0,
        ...value.split(',').map((part) => {
          const text = part.trim()
          return text.endsWith('ms') ? parseFloat(text) / 1000 : parseFloat(text) || 0
        }),
      )
    let max = 0
    for (const element of document.querySelectorAll('*')) {
      const style = getComputedStyle(element)
      if (style.transitionProperty !== 'none')
        max = Math.max(max, seconds(style.transitionDuration))
      if (style.animationName !== 'none') max = Math.max(max, seconds(style.animationDuration))
    }
    return max
  })
}

for (const screen of SCREENS) {
  test(`FR-083 SC-005 ${screen.name} reflows at 320 px and at 400 % zoom, and works in landscape`, async ({
    page,
    mockApi,
    expectNoHorizontalScroll,
  }) => {
    await openScreen(page, screen, mockApi)
    await expectNoHorizontalScroll(page, { widths: [320] })
    if (isNarrow(page)) {
      // Landscape on a phone.
      await page.setViewportSize({ width: 780, height: 360 })
      await expectNoHorizontalScroll(page, { widths: [780] })
    } else {
      // 400 % zoom of a 1280 px desktop window is 320 CSS px.
      await page.setViewportSize({ width: 320, height: 225 })
      await expectNoHorizontalScroll(page, { widths: [320] })
    }
    const target = screen.open
      ? page.locator('[role="dialog"], [role="alertdialog"], [role="menu"]')
      : page.getByRole('heading', { level: 1 }).first()
    await expect(target).toBeVisible()
  })

  test(`FR-085 ${screen.name} runs no transition under reduced motion`, async ({
    page,
    mockApi,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openScreen(page, screen, mockApi)
    expect(await longestMotion(page)).toBeLessThanOrEqual(0.001)
  })
}

for (const [scenario, path] of [
  ['api-keys-many', 'api-keys'],
  ['audit-records', 'audit-log'],
  ['user-with-passkeys', 'passkeys'],
] as const) {
  test(`FR-080 WCAG 2.4.11 the sticky header never hides the focused element on ${path}`, async ({
    page,
    mockApi,
  }) => {
    await mockApi.use(scenario)
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
    await page.getByRole('heading', { level: 1 }).first().focus()
    for (let step = 0; step < 30; step++) {
      await page.keyboard.press('Tab')
      const obscured = await page.evaluate(() => {
        const focused = document.activeElement
        const header = document.querySelector('header')
        if (!focused || !header || header.contains(focused) || focused === document.body) {
          return null
        }
        // A fixed element (the skip link) floats above the header.
        if (getComputedStyle(focused).position === 'fixed') return null
        const rect = focused.getBoundingClientRect()
        const bar = header.getBoundingClientRect()
        return rect.bottom <= bar.bottom ? (focused.textContent ?? focused.tagName).trim() : null
      })
      expect(obscured, 'a focused element hidden behind the sticky header').toBeNull()
    }
  })
}
