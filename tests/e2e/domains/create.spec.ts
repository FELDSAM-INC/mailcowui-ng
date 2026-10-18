// UI 002 US2, adding a domain (T047) with the classic "Add domain" form (owner rule 1:1): the
// Default template applied, another template replacing the values, every field, the two add
// actions, legacy's messages for refusals, and the outcomes as legacy's alerts on the domain page.
import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { isMobile, listReady } from './helpers'

const MIB = 1024 ** 2
const GIB = 1024 * MIB

const name = (page: Page) => page.getByRole('textbox', { name: 'Domain (required)' })
const field = (page: Page, label: string) => page.getByRole('textbox', { name: label, exact: true })
const actions = (page: Page) => page.locator('[data-sticky-save]')

async function openCreate(page: Page) {
  await page.goto('domains/-/new')
  await expect(page.getByRole('heading', { level: 1, name: 'Add domain' })).toBeVisible()
  await expect(name(page)).toBeVisible()
}

async function addOnly(page: Page) {
  await actions(page).getByRole('button', { name: 'Add domain only' }).click()
}

async function createRequests(mockApi: {
  requests(): Promise<{ operationId: string | null; status: number; body?: unknown }[]>
}) {
  return (await mockApi.requests()).filter(
    (request) => request.operationId === 'createDomain' && request.status !== 403,
  )
}

test.describe('add a domain', () => {
  test('US2-AS1 the classic form with the Default values; "Add domain only" opens the domain page with the outcomes', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
  }) => {
    await mockApi.use('domain-create')
    await openCreate(page)
    await expect(page.getByLabel('Template', { exact: true })).toHaveValue('1')
    await expect(field(page, 'Max. possible aliases')).toHaveValue('400')
    await expect(field(page, 'Max. possible mailboxes')).toHaveValue('10')
    await expect(field(page, 'Default mailbox quota')).toHaveCount(0)
    await expect(field(page, 'Max. quota per mailbox (MiB)')).toHaveValue('10240')
    await expect(field(page, 'Total domain quota (MiB)')).toHaveValue('10240')
    await expect(page.getByRole('checkbox', { name: 'Global Address List' })).toBeChecked()
    await expect(page.getByRole('checkbox', { name: 'Active' })).toBeChecked()
    await expect(page.getByPlaceholder('Disabled')).toHaveValue('')
    await expect(field(page, 'Selector')).toHaveValue('dkim')
    await expect(page.getByLabel('DKIM key length (bits)')).toHaveValue('2048')
    await expect(page.locator('[data-post-domain-add]')).toContainText(
      'needs to be restarted after adding a new domain',
    )
    await expectAccessible()
    await expectNoHorizontalScroll()
    await name(page).fill('example.org')
    await addOnly(page)
    await expect(page).toHaveURL(/\/ng\/domains\/example\.org$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Edit domain' })).toBeVisible()
    const report = page.locator('[data-creation-report]')
    await expect(report.locator('[data-alert]')).toHaveText([
      'DKIM key example.org has been saved',
      'Added domain example.org',
    ])
    await expect(page.locator('[data-live="polite"]')).toContainText('Added domain example.org')
    await expectAccessible()
    const [request] = await createRequests(mockApi)
    expect(request!.body).toMatchObject({ templateId: 1, restartGroupware: false, rateLimit: null })
  })

  test('US2-AS2 FR-019 the Reseller template replaces the values without asking; the request holds exactly them', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('domain-create')
    await openCreate(page)
    await name(page).fill('reseller-client.example')
    await field(page, 'Max. possible mailboxes').fill('3')
    await page.getByLabel('Template', { exact: true }).selectOption({ label: 'Reseller' })
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    await expect(field(page, 'Max. possible mailboxes')).toHaveValue('50')
    await expect(name(page)).toHaveValue('reseller-client.example')
    await expect(page.getByPlaceholder('Disabled')).toHaveValue('100')
    await field(page, 'Max. possible mailboxes').fill('20')
    await actions(page).getByRole('button', { name: 'Add domain and restart SOGo' }).click()
    await expect(page).toHaveURL(/reseller-client\.example$/)
    const [request] = await createRequests(mockApi)
    expect(request!.body).toEqual({
      name: 'reseller-client.example',
      description: '',
      templateId: 2,
      tags: ['reseller'],
      maxAliases: 500,
      maxMailboxes: 20,
      maxMailboxQuota: 10 * GIB,
      domainQuota: 50 * GIB,
      globalAddressList: true,
      active: true,
      rateLimit: { value: 100, frame: 'hour' },
      dkimSelector: 'dkim',
      dkimKeySize: 4096,
      backupMx: false,
      relayAllRecipients: false,
      relayUnknownOnly: false,
      restartGroupware: true,
    })
  })

  test('US2-AS3 an existing domain or alias domain name shows legacy\'s "already exists" on the name, input kept', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('domain-create')
    await openCreate(page)
    for (const typed of ['Taken.example', 'alias.example']) {
      await name(page).fill(typed)
      await field(page, 'Description').fill('Kept')
      await addOnly(page)
      await expect(page.locator('#create-name-error')).toContainText(
        `Domain ${typed} already exists`,
      )
      await expect(name(page)).toHaveValue(typed)
      await expect(field(page, 'Description')).toHaveValue('Kept')
    }
    await expectAccessible()
  })

  test('US2-AS4 FR-020 FR-022 the client rules: an invalid name, quotas out of order and a rate limit of 0 are refused before sending', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('domain-create')
    await openCreate(page)
    await name(page).fill('bad_name')
    await field(page, 'Max. quota per mailbox (MiB)').fill('20480')
    await page.getByPlaceholder('Disabled').fill('0')
    await addOnly(page)
    await expect(page.locator('#create-name-error')).toContainText(
      'Domain name is empty or invalid',
    )
    await expect(page.locator('#create-maxMailboxQuota-error')).toBeVisible()
    await expect(page.locator('#create-rateLimit-error')).toBeVisible()
    expect(await createRequests(mockApi)).toHaveLength(0)
  })

  test("US2-AS5 a failed restart and an existing DKIM key are legacy's alerts, announced", async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('creation-report-mixed')
    await openCreate(page)
    await name(page).fill('mixed.example')
    await actions(page).getByRole('button', { name: 'Add domain and restart SOGo' }).click()
    const report = page.locator('[data-creation-report]')
    await expect(report.locator('[data-alert="success"]')).toHaveText(
      'A DKIM key did already exist',
    )
    await expect(report.locator('[data-alert="warning"]')).toContainText('failed to restart SOGo')
    await expect(page.locator('[data-live="polite"]')).toContainText('failed to restart SOGo')
    await expectAccessible()
    await report.getByRole('button', { name: 'Close' }).click()
    await expect(report).toHaveCount(0)
  })

  test('US2-AS6 leaving with entered values asks first: a link, Back and a reload', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('domain-create')
    await page.goto('domains')
    await listReady(page)
    await page.getByRole('link', { name: 'Add domain' }).first().click()
    await expect(page.getByRole('heading', { level: 1, name: 'Add domain' })).toBeVisible()
    await name(page).fill('leaving.example')
    await page.goBack()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toContainText('Leave without saving?')
    await dialog.getByRole('button', { name: 'Stay' }).click()
    await expect(page).toHaveURL(/domains\/-\/new/)
    await expect(name(page)).toHaveValue('leaving.example')
    const prevented = await page.evaluate(() => {
      const event = new Event('beforeunload', { cancelable: true })
      window.dispatchEvent(event)
      return event.defaultPrevented
    })
    expect(prevented).toBe(true)
    if (isMobile(page)) {
      await page.getByRole('button', { name: 'Toggle navigation' }).click()
      await page.getByRole('dialog').getByRole('link', { name: 'Domains' }).click()
    } else {
      await page
        .getByRole('navigation', { name: 'Main navigation' })
        .getByRole('link', { name: 'Domains' })
        .click()
    }
    await expect(page.getByRole('alertdialog')).toBeVisible()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Leave' }).click()
    await expect(page).toHaveURL(/\/ng\/domains$/)
  })

  test('US2-AS7 a domain administrator has no add action, and the add address says no access', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('domain-admin-two-of-ten')
    await page.goto('domains')
    await listReady(page)
    await expect(page.getByRole('link', { name: 'Add domain' })).toHaveCount(0)
    await page.goto('domains/-/new')
    await expect(page.getByRole('heading', { level: 1, name: 'No access' })).toBeVisible()
    await expectAccessible()
  })

  test('FR-014 FR-018 "Add domain" in the list header and in the empty state opens the form', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('domains-empty')
    await page.goto('domains')
    await expect(page.getByText('There are no domains yet.')).toBeVisible()
    await page.getByRole('main').getByRole('link', { name: 'Add domain' }).last().click()
    await expect(page.getByRole('heading', { level: 1, name: 'Add domain' })).toBeVisible()
  })

  test('FR-021 an empty selector sends no DKIM key; the key lengths come from the server', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('dkim-feldhost')
    await openCreate(page)
    await expect(page.getByLabel('DKIM key length (bits)').locator('option')).toHaveText([
      '1024',
      '2048',
      '3072',
      '4096',
    ])
    await name(page).fill('nodkim.example')
    await field(page, 'Selector').fill('')
    await addOnly(page)
    await expect(page).toHaveURL(/nodkim\.example$/)
    const [request] = await createRequests(mockApi)
    expect(request!.body).toMatchObject({ dkimSelector: '' })
    await expect(page.locator('[data-creation-report] [data-alert]')).toHaveText([
      'Added domain nodkim.example',
    ])
  })

  test('FR-024 with the groupware disabled: no Global Address List, one "Add" action and no restart note', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('groupware-disabled')
    await openCreate(page)
    await expect(page.getByRole('checkbox', { name: 'Global Address List' })).toHaveCount(0)
    await expect(actions(page).getByRole('button', { name: 'Add domain only' })).toHaveCount(0)
    await expect(page.locator('[data-post-domain-add]')).toHaveCount(0)
    await name(page).fill('nogw.example')
    await actions(page).getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page).toHaveURL(/nogw\.example$/)
    const [request] = await createRequests(mockApi)
    expect(request!.body).not.toHaveProperty('globalAddressList')
    expect(request!.body).toMatchObject({ restartGroupware: false })
  })

  test('FR-025 the actions are disabled while sending', async ({ page, mockApi }) => {
    await mockApi.use('domain-create', { delays: { createDomain: 1500 } })
    await openCreate(page)
    await name(page).fill('slow.example')
    await addOnly(page)
    await expect(actions(page).getByRole('button', { name: 'Add domain only' })).toBeDisabled()
    await expect(page).toHaveURL(/slow\.example$/)
  })

  test('loading while the templates and settings load, and an error with retry when they fail', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('domain-create', { delays: { listDomainTemplates: 1500 } })
    await page.goto('domains/-/new')
    await expect(page.locator('[data-page-loading]')).toBeVisible()
    await expect(name(page)).toBeVisible()
    await mockApi.use('domain-create', { failures: { getDomainsCapabilities: { status: 500 } } })
    await page.goto('domains/-/new')
    await expect(
      page.getByText('The domain templates or the server settings could not be loaded.'),
    ).toBeVisible()
  })

  test('FR-027 API field errors are shown on their fields, input kept', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('domain-create')
    await openCreate(page)
    await name(page).fill('ok.example')
    await mockApi.removeTemplate(1)
    await addOnly(page)
    await expect(page.locator('#create-template-error')).toBeVisible()
    await expect(name(page)).toHaveValue('ok.example')
  })

  test('FR-069 FR-070 numeric keypads for limits and quotas', async ({ page, mockApi }) => {
    await mockApi.use('domain-create')
    await openCreate(page)
    for (const label of ['Max. possible mailboxes', 'Total domain quota (MiB)']) {
      await expect(field(page, label)).toHaveAttribute('inputmode', 'numeric')
    }
    await expect(name(page)).toHaveAttribute('autocapitalize', 'none')
  })

  test('Edge: without any template the template defaults apply', async ({ page, mockApi }) => {
    await mockApi.use('templates-none')
    await openCreate(page)
    await expect(field(page, 'Max. possible aliases')).toHaveValue('400')
    await name(page).fill('bare.example')
    await addOnly(page)
    await expect(page).toHaveURL(/bare\.example$/)
    const [request] = await createRequests(mockApi)
    expect(request!.body).not.toHaveProperty('templateId')
  })

  test('Edge: a temporary failure says nothing was changed, and the retry keeps the input', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('create-temporary-failure')
    await openCreate(page)
    await name(page).fill('retry.example')
    await addOnly(page)
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
    await expect(name(page)).toHaveValue('retry.example')
    await page.getByRole('button', { name: 'Try again' }).click()
    await expect(page).toHaveURL(/retry\.example$/)
  })
})
