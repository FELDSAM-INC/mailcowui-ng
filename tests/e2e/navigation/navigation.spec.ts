// T092: navigation by role and permission flags (US3-AS1–AS5, AS7, FR-043–FR-046, FR-050,
// SC-007).
import type { Page } from '@playwright/test'

import { permissionFlags } from '../../mocks/scenarios/accounts'
import { expect, test } from '../fixtures/test'
import { isNarrow, openNavigation, submitPassword } from '../fixtures/flows'

const ADMIN = [
  'Home',
  'Domains',
  // UI 002 US6 adds the domain templates for administrators.
  'Domain Templates',
  'Mailboxes',
  // UI 003 adds the mailbox templates for administrators and domain administrators.
  'Mailbox Templates',
  // UI 004 splits its entry into the classic "Aliases" tab dropdown's three entries.
  'Aliases',
  'Domain aliases',
  'Resources',
  // UI 005 adds Mail setup › Filters for administrators and domain administrators.
  'Filters',
  'User Settings',
  'Passkeys',
  'Quarantine',
  'Administrators',
  'Sync jobs',
  // UI 009 names the entry with the classic Routing tab's label.
  'Routing',
  // UI 010 splits its row into two entries (FR-001).
  'ARC/DKIM keys',
  'MTA-STS',
  // UI 011: the "System" group.
  'System & Containers',
  'Logs',
  'Queue Manager',
  'Fail2ban parameters',
  'Identity providers and OAuth2',
  'System settings',
  'API keys',
  'Audit log',
]
const DOMAIN_ADMIN = [
  'Home',
  'Domains',
  'Mailboxes',
  'Mailbox Templates',
  // UI 004 splits its entry into the classic "Aliases" tab dropdown's three entries.
  'Aliases',
  'Domain aliases',
  'Resources',
  // UI 005 adds Mail setup › Filters for administrators and domain administrators.
  'Filters',
  'User Settings',
  'Passkeys',
  'Quarantine',
  // UI 009: domain administrators always see the BCC maps (read-only without the flag).
  'Routing',
  // UI 010 splits its row into two entries (FR-001).
  'ARC/DKIM keys',
  'MTA-STS',
]
const MAILBOX_USER = ['Home', 'User Settings', 'Passkeys', 'Quarantine']

const withEntry = (base: string[], label: string, after: string) => {
  const list = [...base]
  list.splice(list.indexOf(after) + 1, 0, label)
  return list
}

async function navigationLabels(page: Page): Promise<string[]> {
  const navigation = await openNavigation(page)
  const labels = await navigation.getByRole('link').allInnerTexts()
  if (isNarrow(page)) await page.keyboard.press('Escape')
  return labels.map((label) => label.trim())
}

const CASES: [string, string[]][] = [
  ['admin-active', ADMIN],
  ['domain-admin-no-syncjobs', DOMAIN_ADMIN],
  ['domain-admin-bcc', withEntry(DOMAIN_ADMIN, 'Sync jobs', 'Quarantine')],
  ['mailbox-no-spam-flags', MAILBOX_USER],
  ['mailbox-spam-score', withEntry(MAILBOX_USER, 'Spam filter', 'Quarantine')],
  ['mailbox-spam-policy', withEntry(MAILBOX_USER, 'Spam filter', 'Quarantine')],
  ['mailbox-syncjobs', withEntry(MAILBOX_USER, 'Sync jobs', 'Quarantine')],
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

test('US3-AS3 FR-044 a placeholder names its section, says it comes later and links to the classic page of the role', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
  expectTouchTargets,
}) => {
  // Domains, Mailboxes and DNS became available with UI 002, UI 003 and UI 010, so Quarantine is the
  // placeholder here.
  await mockApi.use('domain-admin-two-domains')
  await page.goto('quarantine')
  const main = page.getByRole('main')
  await expect(page.getByRole('heading', { level: 1, name: 'Quarantine' })).toBeVisible()
  await expect(main).toContainText('This section comes in a later version of the app.')
  await expect(main.getByRole('link', { name: 'Quarantine' })).toHaveAttribute(
    'href',
    '/quarantine',
  )
  await expect(main).toContainText('you sign in there separately')
  await expectAccessible()
  await expectNoHorizontalScroll()
  await expectTouchTargets()

  await mockApi.use('admin-active')
  await page.goto('system')
  await expect(page.getByRole('main').getByRole('link')).toHaveText(['System › Configuration'])
  await expect(
    page.getByRole('main').getByRole('link', { name: 'System Configuration' }),
  ).toHaveAttribute('href', '/admin/system')

  // UI 005 made My account available, so Quarantine is the mailbox user's placeholder here.
  await mockApi.use('mailbox-no-spam-flags')
  await page.goto('quarantine')
  await expect(page.getByRole('main').getByRole('link', { name: 'Quarantine' })).toHaveAttribute(
    'href',
    '/quarantine',
  )
  const ops = (await mockApi.requests()).map((r) => r.operationId)
  expect(
    ops.filter(
      (op) =>
        ![
          'getCsrfToken',
          'getSession',
          'getPublicConfig',
          'getIdentity',
          'getPublicConfigLogo',
        ].includes(op ?? ''),
    ),
  ).toEqual([])
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
    page.getByRole('main').getByRole('link', { name: 'Go to the home screen' }),
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
  await expect(page.getByRole('heading', { level: 1, name: 'Hello, reseller' })).toBeVisible()
  expect(await navigationLabels(page)).not.toContain('Sync jobs')
  await mockApi.patch({
    accounts: {
      reseller: { permissions: permissionFlags(true, { bccMaps: false, loginAs: false }) },
    },
  })
  await page.clock.fastForward('05:01')
  const navigation = await openNavigation(page)
  await navigation.getByRole('link', { name: 'Passkeys' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Passkeys' })).toBeVisible()
  expect(await navigationLabels(page)).toContain('Sync jobs')
})

test('Edge: a deep link to a section the role may not use shows "no access" after sign-in', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('domain-admin-password')
  await page.goto('administrators')
  await expect(page).toHaveURL(/sign-in\?returnTo=(%2F|\/)administrators$/)
  await submitPassword(page, 'reseller')
  await expect(page).toHaveURL(/\/ng\/administrators$/)
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
      .getByRole('link')
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
