// UI 012 T095 (FR-071 to FR-074, SC-004, SC-005): every screen and dialog of the feature reflows at
// 320 px and at 400 % zoom, works in landscape on phones, runs no transition under reduced motion,
// keeps the focused element out from under the sticky header, and the main paths work with the
// keyboard alone.
import type { Page } from '@playwright/test'

import type { ScenarioOverrides } from '../../mocks/scenarios'
import { expect, test } from '../fixtures/test'
import { isNarrow } from './helpers'

interface Screen {
  name: string
  scenario: string
  overrides?: ScenarioOverrides
  path: string
  /** Brings the screen into the state to check. */
  open?: (page: Page) => Promise<void>
}

const SCREENS: Screen[] = [
  {
    name: 'the identity provider setup',
    scenario: 'idp-none',
    path: 'identity-providers/provider',
  },
  {
    name: 'the LDAP form with errors',
    scenario: 'idp-none',
    path: 'identity-providers/provider',
    open: async (page) => {
      await page.locator('#idp-type').selectOption({ label: 'LDAP' })
      await page.getByRole('button', { name: 'Save changes', exact: true }).click()
      await expect(
        page.getByRole('heading', { name: 'Please correct the following' }),
      ).toBeVisible()
    },
  },
  {
    name: 'the stored configuration',
    scenario: 'idp-keycloak',
    path: 'identity-providers/provider',
  },
  {
    name: 'the section edit',
    scenario: 'idp-keycloak',
    path: 'identity-providers/provider?edit=provider',
  },
  {
    name: 'a connection test result',
    scenario: 'idp-ldap',
    overrides: { identityProvider: { connectionTest: { outcome: 'unexpectedResponse' } } },
    path: 'identity-providers/provider',
    open: async (page) => {
      await page.getByRole('button', { name: 'Test Connection' }).click()
      await expect(page.locator('[data-test-result]')).toBeVisible()
    },
  },
  {
    name: 'the removal confirmation',
    scenario: 'idp-ldap',
    path: 'identity-providers/provider',
    open: async (page) => {
      await page.locator('#section-provider').getByRole('button', { name: 'Remove' }).click()
      await expect(page.getByRole('alertdialog')).toBeVisible()
    },
  },
]

// UI 012 US2: the sign-in screens with single sign-on and the return page's outcomes.
SCREENS.push(
  { name: 'the sign-in screen with single sign-on', scenario: 'sso-available', path: 'sign-in' },
  {
    name: 'the forced single sign-on screen',
    scenario: 'sso-force',
    path: 'sign-in/mailbox-user',
  },
  {
    name: 'the return page with an expired sign-in',
    scenario: 'sso-available',
    path: 'sso/return?code=old-code&state=foreign-state',
    open: async (page) => {
      await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
    },
  },
)

// UI 012 US5: the OAuth2 apps screens and dialogs.
SCREENS.push(
  { name: 'the OAuth2 apps', scenario: 'oauth2-many', path: 'identity-providers/oauth2-apps' },
  {
    name: 'the OAuth2 client form',
    scenario: 'oauth2-empty',
    path: 'identity-providers/oauth2-apps/new',
  },
  {
    name: 'an OAuth2 client',
    scenario: 'oauth2-many',
    path: 'identity-providers/oauth2-apps/1',
  },
  {
    name: 'the new OAuth2 secret',
    scenario: 'oauth2-empty',
    path: 'identity-providers/oauth2-apps/new',
    open: async (page) => {
      await page
        .getByRole('textbox', { name: /Redirect URI/ })
        .fill('https://wiki.example.org/oauth/callback')
      await page.getByRole('button', { name: 'Add', exact: true }).click()
      await expect(page.getByRole('dialog', { name: 'Add OAuth2 client' })).toBeVisible()
    },
  },
  {
    name: 'the OAuth2 bulk results',
    scenario: 'oauth2-bulk-partial',
    path: 'identity-providers/oauth2-apps',
    open: async (page) => {
      await page.getByRole('button', { name: 'Select', exact: true }).click()
      await page.getByRole('checkbox', { name: 'Select all on this page' }).first().check()
      await page.getByRole('button', { name: 'Revoke all client tokens' }).click()
      await page.getByRole('alertdialog').getByRole('button').last().click()
      await expect(page.getByRole('heading', { name: 'Results' })).toBeVisible()
    },
  },
)

async function openScreen(
  page: Page,
  screen: Screen,
  mockApi: { use: (n: string, o?: ScenarioOverrides) => Promise<string> },
) {
  await mockApi.use(screen.scenario, screen.overrides)
  await page.goto(screen.path)
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
  await expect(page.locator('[data-page-loading]')).toHaveCount(0)
  await screen.open?.(page)
}

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
  test(`FR-072 SC-005 ${screen.name} reflows at 320 px and at 400 % zoom, and works in landscape`, async ({
    page,
    mockApi,
    expectNoHorizontalScroll,
  }) => {
    await openScreen(page, screen, mockApi)
    await expectNoHorizontalScroll(page, { widths: [320] })
    if (isNarrow(page)) {
      await page.setViewportSize({ width: 780, height: 360 })
      await expectNoHorizontalScroll(page, { widths: [780] })
    } else {
      await page.setViewportSize({ width: 320, height: 225 })
      await expectNoHorizontalScroll(page, { widths: [320] })
    }
  })

  test(`FR-071 ${screen.name} runs no transition under reduced motion`, async ({
    page,
    mockApi,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openScreen(page, screen, mockApi)
    expect(await longestMotion(page)).toBeLessThanOrEqual(0.001)
  })
}

test('WCAG 2.4.11 the sticky header never hides the focused element in the setup form', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('idp-none')
  await page.goto('identity-providers/provider')
  await expect(page.locator('#idp-type')).toBeVisible()
  await page.getByRole('heading', { level: 1 }).first().focus()
  for (let step = 0; step < 40; step++) {
    await page.keyboard.press('Tab')
    const obscured = await page.evaluate(() => {
      const focused = document.activeElement
      const header = document.querySelector('header')
      if (!focused || !header || header.contains(focused) || focused === document.body) return null
      if (getComputedStyle(focused).position === 'fixed') return null
      const rect = focused.getBoundingClientRect()
      const bar = header.getBoundingClientRect()
      return rect.bottom <= bar.bottom ? (focused.textContent ?? focused.tagName).trim() : null
    })
    expect(obscured, 'a focused element hidden behind the sticky header').toBeNull()
  }
})

test('SC-004 FR-073 an LDAP setup works with the keyboard alone, with visible focus', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('idp-none')
  await page.goto('identity-providers/provider')
  const type = page.locator('#idp-type')
  await expect(type).toBeVisible()
  await type.focus()
  await page.keyboard.press('End')
  await expect(type).toHaveValue('ldap')
  const typeInto = async (id: string, value: string) => {
    await page.keyboard.press('Tab')
    await expect(page.locator(id)).toBeFocused()
    await page.keyboard.type(value)
  }
  await typeInto('#idp-hosts', 'ldap1.example.org')
  await page.keyboard.press('Tab')
  await expect(page.locator('#idp-port')).toBeFocused()
  for (const id of ['#idp-useSsl', '#idp-useStartTls', '#idp-ignoreTlsErrors']) {
    await page.keyboard.press('Tab')
    await expect(page.locator(id)).toBeFocused()
  }
  await typeInto('#idp-baseDn', 'dc=example,dc=org')
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  await expect(page.locator('#idp-attributeField')).toBeFocused()
  await typeInto('#idp-bindDn', 'cn=admin,dc=example,dc=org')
  await typeInto('#idp-bindPassword', 'ldap-secret')
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle)
  const ring = await page.evaluate(() => getComputedStyle(document.activeElement!).boxShadow)
  expect(outline !== 'none' || ring !== 'none').toBe(true)
  await page.getByRole('button', { name: 'Save changes', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('[data-page-status]')).toContainText(/have been saved/)
})
