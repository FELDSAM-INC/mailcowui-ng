// T092: navigation by role and permission flags (US3-AS1–AS5, AS7, FR-043–FR-046, FR-050,
// SC-007).
import type { Page } from '@playwright/test'

import { permissionFlags } from '../../mocks/scenarios/accounts'
import { expect, test } from '../fixtures/test'
import { expectLanding, isNarrow, openNavigation, submitPassword } from '../fixtures/flows'

const ADMIN = [
  'Domains',
  'Mailboxes',
  'Aliases',
  'Resources',
  'Filters',
  'Sync jobs',
  'Routing',
  'Quarantine',
  'System & Containers',
  'Access',
  'Options',
  'Routing',
]
const DOMAIN_ADMIN = [
  'Domains',
  'Mailboxes',
  'Aliases',
  'Resources',
  'Filters',
  'Routing',
  'Quarantine',
  'Options',
]
const MAILBOX_USER = ['Quarantine']
const withEntry = (base: string[], label: string, after: string) => {
  const list = [...base]
  list.splice(list.indexOf(after) + 1, 0, label)
  return list
}

async function navigationLabels(page: Page): Promise<string[]> {
  const navigation = await openNavigation(page)
  const labels = await navigation.locator('a').allInnerTexts()
  if (isNarrow(page)) await page.keyboard.press('Escape')
  return labels.map((label) => label.trim())
}

const CASES: [string, string[]][] = [
  ['admin-active', ADMIN],
  ['domain-admin-no-syncjobs', DOMAIN_ADMIN],
  ['domain-admin-bcc', withEntry(DOMAIN_ADMIN, 'Sync jobs', 'Filters')],
  ['mailbox-no-spam-flags', MAILBOX_USER],
  ['mailbox-spam-score', withEntry(MAILBOX_USER, 'Spam filter', 'Quarantine')],
  ['mailbox-spam-policy', withEntry(MAILBOX_USER, 'Spam filter', 'Quarantine')],
  ['mailbox-syncjobs', ['Sync jobs', ...MAILBOX_USER]],
]

for (const [scenario, expected] of CASES) {
  test(`US3-AS1 US3-AS2 SC-007 the navigation equals the catalogue for ${scenario}`, async ({
    page,
    mockApi,
  }) => {
    await mockApi.use(scenario)
    await page.goto('')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    expect(await navigationLabels(page)).toEqual(expected)
  })
}

test('unfinished destinations are visible but disabled with no link action', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
  expectTouchTargets,
}) => {
  await mockApi.use('admin-active')
  await page.goto('domains')
  const navigation = await openNavigation(page)
  for (const id of ['systemMails', 'globalFilterMaps']) {
    const item = navigation.locator(`[data-nav-item="${id}"]`)
    await expect(item).toHaveAttribute('aria-disabled', 'true')
    await expect(item).not.toHaveAttribute('href')
  }
  await expectAccessible()
  await expectNoHorizontalScroll()
  await expectTouchTargets()
})

test('US3-AS4 FR-045 the API keys address shows "no access" to a domain administrator and requests no key data', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('domain-admin-two-domains')
  await page.goto('api-keys')
  await expect(page.getByRole('heading', { level: 1, name: 'No access' })).toBeVisible()
  await expect(
    page.getByRole('main').getByRole('link', { name: 'Go to the main page' }),
  ).toHaveAttribute('href', '/ng/')
  await expectAccessible()
  const ops = (await mockApi.requests()).map((r) => r.operationId)
  expect(ops).not.toContain('listApiKeys')
})

test('US3-AS5 FR-046 the navigation at 360 px opens from one control, works by keyboard, closes after a choice and returns focus', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  test.skip(!isNarrow(page), 'the drawer exists below 1024 px')
  await mockApi.use('admin-active')
  await page.goto('domains')
  const button = page.getByRole('button', { name: 'Toggle navigation' })
  await button.focus()
  await page.keyboard.press('Enter')
  const drawer = page.getByRole('dialog')
  await expect(drawer).toBeVisible()
  await expectAccessible()
  await expect(drawer.locator(':focus')).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(drawer).toHaveCount(0)
  await expect(button).toBeFocused()
  await button.tap()
  await page.getByRole('dialog').getByRole('link', { name: 'Quarantine' }).tap()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 1, name: 'Quarantine' })).toBeFocused()
})

test('US3-AS7 FR-050 changed permission flags show after the identity is read again five minutes later', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('flags-change')
  await page.clock.install()
  await page.goto('')
  await expectLanding(page, 'domainAdmin')
  expect(await navigationLabels(page)).not.toContain('Sync jobs')
  await mockApi.patch({
    accounts: {
      reseller: { permissions: permissionFlags(true, { bccMaps: false, loginAs: false }) },
    },
  })
  await page.clock.fastForward('05:01')
  const navigation = await openNavigation(page)
  await navigation.getByRole('link', { name: 'Mailboxes', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Mailboxes' })).toBeVisible()
  expect(await navigationLabels(page)).toContain('Sync jobs')
})

test('Edge: a deep link to a section the role may not use shows "no access" after sign-in', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('domain-admin-password')
  await page.goto('administrators/admins')
  await expect(page).toHaveURL(/sign-in\?returnTo=(%2F|\/)administrators(%2F|\/)admins$/)
  await submitPassword(page, 'reseller')
  await expect(page).toHaveURL(/\/ng\/administrators\/admins$/)
  await expect(page.getByRole('heading', { level: 1, name: 'No access' })).toBeVisible()
})

for (const scenario of ['admin-active', 'domain-admin-bcc', 'mailbox-syncjobs']) {
  test(`SC-007 every navigation entry of ${scenario} opens a screen or a placeholder, never "not found"`, async ({
    page,
    mockApi,
  }) => {
    await mockApi.use(scenario)
    await page.goto('')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    const navigation = await openNavigation(page)
    const hrefs = await navigation
      .locator('a')
      .evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''))
    if (isNarrow(page)) await page.keyboard.press('Escape')
    for (const href of hrefs) {
      await page.goto(href.replace(/^\/ng\//, ''))
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toHaveCount(0)
      await expect(page.getByRole('heading', { level: 1, name: 'No access' })).toHaveCount(0)
    }
  })
}
