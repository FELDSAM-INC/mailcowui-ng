// UI 003 US2, adding a mailbox (T062) on legacy's "Add mailbox" form: the normalised address, the
// quota of the domain with legacy's badge and warning, templates replacing the values, the password
// generator and policy, legacy's message on the new mailbox's page, errors kept on their fields,
// the domain administrator's gates, the creation report and the list's entry points.
import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'

const form = (page: Page) => page.locator('[data-mailbox-form]')

async function open(page: Page, domain = 'example.org') {
  await page.goto(`mailboxes/new?domain=${domain}`)
  await expect(page.getByRole('heading', { level: 1, name: 'Add mailbox' })).toBeVisible()
  await expect(form(page)).toBeVisible()
}

async function fill(page: Page, localPart: string, password = 'Secret-123') {
  await page.getByLabel('Username (left part of an email address)').fill(localPart)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByLabel('Confirmation password (repeat)').fill(password)
}

async function creates(mockApi: {
  requests(): Promise<{ operationId: string | null; body?: unknown }[]>
}) {
  return (await mockApi.requests()).filter((r) => r.operationId === 'createMailbox')
}

test.describe('add mailbox', () => {
  test('US2-AS1 FR-025 FR-067 the local part normalised, created with only the essentials, and legacy’s message', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
  }) => {
    await mockApi.use('admin-create')
    await open(page)
    await expect(form(page)).toContainText('@example.org')
    await page.getByLabel('Username (left part of an email address)').fill(' Anna.Smith2 ')
    await page.getByRole('button', { name: '(generate)' }).click()
    await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'text')
    await expectAccessible()
    await expectNoHorizontalScroll()
    await page
      .locator('[data-sticky-save]')
      .getByRole('button', { name: 'Add', exact: true })
      .click()
    await expect(page).toHaveURL(/\/ng\/mailboxes\/anna\.smith2@example\.org$/)
    await expect(page.locator('[data-flash="success"]')).toHaveText(
      'Mailbox anna.smith2@example.org has been added',
    )
    const [request] = await creates(mockApi)
    expect(Object.keys(request!.body as object).sort()).toEqual([
      'domain',
      'localPart',
      'password',
      'quota',
      'templateId',
    ])
  })

  test('US2-AS2 the quota of the domain with legacy’s badge; too much is refused on the field', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('admin-create')
    await open(page)
    const quota = page.getByLabel('Quota (MiB)')
    await expect(quota).toHaveValue('5120')
    await expect(form(page)).toContainText('max. 5,120 MiB')
    await fill(page, 'big.user')
    await quota.fill('8192')
    await page
      .locator('[data-sticky-save]')
      .getByRole('button', { name: 'Add', exact: true })
      .click()
    await expect(quota).toHaveAttribute('aria-invalid', 'true')
    expect(await creates(mockApi)).toHaveLength(0)
  })

  test('US2-AS3 FR-021 another template replaces the values without asking', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('admin-create')
    await open(page)
    await page.getByLabel('Template').selectOption({ label: 'Small' })
    await expect(page.getByLabel('Quota (MiB)')).toHaveValue('1024')
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
  })

  test('US2-AS7 FR-027 a taken address names the alias on the field and keeps every entry', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('admin-create')
    await open(page)
    await fill(page, 'anna')
    await page
      .locator('[data-sticky-save]')
      .getByRole('button', { name: 'Add', exact: true })
      .click()
    const field = page.getByLabel('Username (left part of an email address)')
    await expect(field).toHaveAttribute('aria-invalid', 'true')
    await expect(form(page)).toContainText('anna@example.org')
    await expect(page.getByLabel('Password', { exact: true })).toHaveValue('Secret-123')
  })

  test('US2-AS8 a full domain is refused with legacy’s message', async ({ page, mockApi }) => {
    await mockApi.use('admin-create')
    await open(page, 'full.example')
    await fill(page, 'second')
    await page
      .locator('[data-sticky-save]')
      .getByRole('button', { name: 'Add', exact: true })
      .click()
    await expect(form(page).locator('[data-form-error]')).toBeVisible()
  })

  test('US2-AS9 no quota left: legacy’s warning and only unlimited mailboxes', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('admin-create')
    await open(page, 'nospace.example')
    await expect(form(page)).toContainText(
      'Domain quota exceeded: Only unlimited mailboxes can be created in this domain scope.',
    )
    await expect(page.getByLabel('Quota (MiB)')).toHaveValue('0')
  })

  test('US2-AS4 the strict policy is listed and a generated password meets it', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('password-policy-strict')
    await open(page)
    await expect(form(page)).toContainText('10')
    await page.getByLabel('Username (left part of an email address)').fill('strict.user')
    await page.getByRole('button', { name: '(generate)' }).click()
    await page
      .locator('[data-sticky-save]')
      .getByRole('button', { name: 'Add', exact: true })
      .click()
    await expect(page).toHaveURL(/strict\.user@example\.org$/)
  })

  test('US2-AS5 a domain administrator without the flags gets the protocols read-only', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('domain-admin-create-limited')
    await open(page)
    await expect(form(page)).toContainText('Prohibited by ACL')
  })

  test('creation report: a failed follow-up step is reported on the new mailbox', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('create-report-failures')
    await open(page)
    await fill(page, 'report.user')
    await page
      .locator('[data-sticky-save]')
      .getByRole('button', { name: 'Add', exact: true })
      .click()
    await expect(page.locator('[data-flash="warning"]')).toContainText(
      'its rate limit could not be applied',
    )
  })

  test('US2-AS10 a lost connection keeps the entries and a resubmit works', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('admin-create')
    await open(page)
    await fill(page, 'retry.user')
    await page.route('**/api/v2/mailboxes', (route) =>
      route.request().method() === 'POST' ? route.abort() : route.continue(),
    )
    await page
      .locator('[data-sticky-save]')
      .getByRole('button', { name: 'Add', exact: true })
      .click()
    await expect(page.getByLabel('Password', { exact: true })).toHaveValue('Secret-123')
    await page.unroute('**/api/v2/mailboxes')
    await page
      .locator('[data-sticky-save]')
      .getByRole('button', { name: 'Add', exact: true })
      .click()
    await expect(page).toHaveURL(/retry\.user@example\.org$/)
  })

  test('FR-020 the list offers "Add mailbox" and an empty scope offers it too', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('mailboxes-empty-filter')
    await page.goto('mailboxes')
    await expect(page.locator('[data-empty="none"]')).toBeVisible()
    await page.locator('[data-empty="none"]').getByRole('link', { name: 'Add mailbox' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Add mailbox' })).toBeVisible()
  })

  test('FR-066 a double click sends one request', async ({ page, mockApi }) => {
    await mockApi.use('admin-create', { delays: { createMailbox: 800 } })
    await open(page)
    await fill(page, 'double.user')
    await page
      .locator('[data-sticky-save]')
      .getByRole('button', { name: 'Add', exact: true })
      .dblclick()
    await expect(page).toHaveURL(/double\.user@example\.org$/)
    expect(await creates(mockApi)).toHaveLength(1)
  })
})
