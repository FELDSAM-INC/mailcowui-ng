// T136: the authentication audit log (US8-AS1, AS2, AS4–AS7, FR-071–FR-074, SC-011). US8-AS3
// (unknown codes) is unit-tested: the pinned contract's enumerations are closed (research R24).
import type { Locator, Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { LONG_USER_AGENT } from '../../mocks/scenarios/audit-log'

// The accessibility checks over a page of 25 records take long on WebKit, more so under load.
test.slow(({ browserName }) => browserName === 'webkit', 'axe over 25 records is slow on WebKit')

const wide = (page: Page) => (page.viewportSize()?.width ?? 0) >= 768

/** The filter form, opened on narrow screens where it starts collapsed. */
async function filters(page: Page): Promise<Locator> {
  const toggle = page.getByRole('button', { name: 'Filters', exact: true })
  if ((await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click()
  return page.getByRole('form', { name: 'Filters' })
}

/** The records: cards below 768 px, table rows (without the header row) from 768 px. */
function records(page: Page): Locator {
  return wide(page)
    ? page.getByRole('table', { name: 'Audit records' }).locator('tbody > tr[data-record]')
    : page.getByRole('list', { name: 'Audit records' }).getByRole('listitem')
}

async function openLog(page: Page, path = 'audit-log') {
  await page.goto(path)
  await expect(page.getByRole('heading', { level: 1, name: 'Audit log' })).toBeVisible()
}

async function apply(page: Page) {
  await (await filters(page)).getByRole('button', { name: 'Apply filters' }).click()
}

const summary = (page: Page) => page.getByText(/^\d+–\d+ of \d+$|^No entries$/)

test('US8-AS1 SC-011 failed sign-ins from an address show the attempted username, local time, address and reason', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('audit-records')
  await openLog(page)
  const form = await filters(page)
  await form.getByRole('checkbox', { name: 'Sign-in' }).check()
  await form.getByLabel('Outcome').selectOption('failure')
  await form.getByLabel('Client address').fill('192.0.2.10')
  await expectAccessible()
  await apply(page)
  await expect(summary(page)).toHaveText('1–3 of 3')
  const first = records(page).first()
  await expect(first).toContainText('alice@example.org (attempted)')
  await expect(first).toContainText('192.0.2.10')
  await expect(first).toContainText('Wrong username or password')
  await expect(first).toContainText('Failure')
  await expect(first.locator('time')).toHaveAttribute('datetime', /Z$/)
  const request = (await mockApi.requests()).findLast((r) => r.operationId === 'listAuditEvents')
  expect(request?.path).toContain('eventType=signIn')
  expect(request?.path).toContain('outcome=failure')
  expect(request?.path).toContain('clientAddress=192.0.2.10')
  await expectAccessible()
  await expectNoHorizontalScroll()
})

test('US8-AS2 key creations and revocations show the acting administrator, the key and the time', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('audit-records')
  await openLog(page)
  const form = await filters(page)
  await form.getByRole('checkbox', { name: 'API key created' }).check()
  await form.getByRole('checkbox', { name: 'API key revoked' }).check()
  await apply(page)
  await expect(summary(page)).toHaveText('1–3 of 3')
  const rows = records(page)
  await expect(rows.nth(0)).toContainText('API key created')
  await expect(rows.nth(0)).toContainText('admin (Administrator)')
  await expect(rows.nth(1)).toContainText('API key revoked')
  await expect(rows.nth(2)).toContainText('API key 01JB3K4M5N6P7Q8R9S0TVWXYZB of admin')
  await rows.nth(0).getByRole('button', { name: 'Show details' }).click()
  await expect(page.getByText('Billing system')).toBeVisible()
  await expect(rows.nth(0).locator('time')).toBeVisible()
  await expectAccessible()
})

test('US8-AS4 filters that match nothing give an empty state that clears them', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('audit-records')
  await openLog(page)
  const form = await filters(page)
  await form.getByLabel('User or API key').fill('nobody@example.org')
  await apply(page)
  const main = page.getByRole('main')
  await expect(main.getByText('No records match these filters.')).toBeVisible()
  await expectAccessible()
  await main.getByRole('button', { name: 'Clear filters' }).last().click()
  await expect(summary(page)).toHaveText('1–25 of 41')
  await expect(page).toHaveURL(/\/ng\/audit-log$/)
})

test('US8-AS5 a reload or the shared address keeps the filters', async ({
  page,
  context,
  mockApi,
}) => {
  await mockApi.use('audit-records')
  await openLog(page)
  const form = await filters(page)
  await form.getByRole('checkbox', { name: 'Sign-in' }).check()
  await form.getByLabel('Outcome').selectOption('failure')
  await apply(page)
  await expect(summary(page)).toHaveText('1–12 of 12')
  await expect(page).toHaveURL(/event=signIn/)
  await page.reload()
  await expect(summary(page)).toHaveText('1–12 of 12')
  await expect((await filters(page)).getByRole('checkbox', { name: 'Sign-in' })).toBeChecked()

  const other = await context.newPage()
  await other.goto(page.url())
  await expect(summary(other)).toHaveText('1–12 of 12')
  await expect(other.getByRole('region', { name: 'Active filters' })).toContainText('Failure')
  await other.close()
})

test('US8-AS6 a malformed address or a start after the end gives a message on the field', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('audit-records')
  await openLog(page)
  const before = (await mockApi.requests()).filter((r) => r.operationId === 'listAuditEvents')
  const form = await filters(page)
  await form.getByLabel('Client address').fill('999.1.1.1')
  await apply(page)
  const address = form.getByLabel('Client address')
  await expect(address).toHaveAttribute('aria-invalid', 'true')
  await expect(form.getByText('Enter an IPv4 or IPv6 address or network')).toBeVisible()
  await expect(address).toBeFocused()
  await expectAccessible()

  await address.fill('')
  await form.getByLabel('Time range').selectOption('custom')
  await form.getByLabel('From', { exact: true }).fill('2026-10-10T12:00')
  await form.getByLabel('To', { exact: true }).fill('2026-10-01T12:00')
  await apply(page)
  await expect(form.getByLabel('To', { exact: true })).toHaveAttribute('aria-invalid', 'true')
  await expect(form.getByText('The end must be after the start.')).toBeVisible()
  const after = (await mockApi.requests()).filter((r) => r.operationId === 'listAuditEvents')
  expect(after).toHaveLength(before.length)
  await expectAccessible()
})

for (const account of ['reseller', 'alice@example.org']) {
  test(`US8-AS7 FR-071 ${account} gets "no access" and no audit data`, async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('audit-records', { signedInAs: account })
    await page.goto('audit-log')
    await expect(page.getByRole('heading', { level: 1, name: 'No access' })).toBeVisible()
    const ops = (await mockApi.requests()).map((r) => r.operationId)
    expect(ops).not.toContain('listAuditEvents')
    await expectAccessible()
  })
}

test('FR-072 25 records per page with the total; an expanded record shows target, user agent, request ID and details', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('audit-records')
  await openLog(page)
  await expect(summary(page)).toHaveText('1–25 of 41')
  await expect(records(page)).toHaveCount(25)
  const pagination = page.getByRole('navigation', { name: 'Pagination' })
  await expect(pagination).toBeVisible()

  const first = records(page).first()
  await first.getByRole('button', { name: 'Show details' }).click()
  const details = page.getByRole('region', { name: /Details of/ }).first()
  await expect(details).toContainText('Target')
  await expect(details).toContainText('Session')
  await expect(details).toContainText('User agent')
  await expect(details).toContainText('Request ID')
  await expect(details).toContainText(/[0-9a-f]{32}/)
  await expect(details).toContainText('requestedRole')
  await expectAccessible()

  const long = records(page).nth(12)
  await long.getByRole('button', { name: 'Show details' }).click()
  await expect(page.getByText(LONG_USER_AGENT.slice(0, 40))).toBeVisible()
  await expectNoHorizontalScroll()

  await page.getByRole('button', { name: 'Next page' }).click()
  await expect(summary(page)).toHaveText('26–41 of 41')
  await expect(page).toHaveURL(/page=2/)
})

test('FR-073 presets, several event types, and chips removed one by one and all at once', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('audit-records')
  await page.clock.install()
  await openLog(page)
  const form = await filters(page)
  const range = form.getByLabel('Time range')
  for (const [preset, total] of [
    ['24h', '1–13 of 13'],
    ['7d', '1–17 of 17'],
    ['30d', '1–25 of 25'],
  ] as const) {
    await range.selectOption(preset)
    await apply(page)
    await expect(summary(page)).toHaveText(total)
  }
  await expect(page).toHaveURL(/range=30d/)

  await form.getByRole('checkbox', { name: 'Sign-in' }).check()
  await form.getByRole('checkbox', { name: 'Sign-out' }).check()
  await form.getByLabel('Outcome').selectOption('success')
  await apply(page)
  const chips = page.getByRole('region', { name: 'Active filters' })
  await expect(chips.getByRole('button', { name: /^Remove filter: / })).toHaveText([
    'Last 30 days',
    'Sign-in',
    'Sign-out',
    'Success',
  ])
  await expectAccessible()
  await expectNoHorizontalScroll()

  await chips.getByRole('button', { name: 'Remove filter: Sign-out' }).click()
  await expect(page).not.toHaveURL(/event=signOut/)
  await expect(chips.getByRole('button', { name: /^Remove filter: / })).toHaveCount(3)
  await chips.getByRole('button', { name: 'Clear all filters' }).click()
  await expect(page.getByRole('region', { name: 'Active filters' })).toHaveCount(0)
  await expect(summary(page)).toHaveText('1–25 of 41')
})

test('Edge: the empty audit log explains itself', async ({ page, mockApi, expectAccessible }) => {
  await mockApi.use('audit-empty')
  await openLog(page)
  await expect(page.getByRole('main').getByText('No audit records yet.')).toBeVisible()
  await expectAccessible()
})
