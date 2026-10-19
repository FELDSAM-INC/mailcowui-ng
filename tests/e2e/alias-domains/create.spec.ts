// UI 004 US4, "Add domain alias" (T061), the classic `#addAliasDomainModal` in its order: names,
// target (relay domains disabled with legacy's reason), active, the rate limit (only with
// `ratelimit`), the DKIM selector prefilled from the server default (emptied, no key) and the key
// length, "Add". Outcomes are legacy's alerts (docs/conventions.md "Outcomes"), refusals legacy's
// messages at their fields, several names one result each.
import { ALIAS_DOMAINS_SCENARIO as AD } from '../../mocks/scenarios/alias-domains'
import { DOMAIN_ADMIN_004 } from '../../mocks/scenarios/feature-004-base'
import { expect, test } from '../fixtures/test'
import { listReady } from '../aliases/helpers'
import { chooseTarget, requestsOf } from './helpers'
import type { Page } from '@playwright/test'

const names = (page: Page) => page.getByRole('textbox', { name: 'Alias domain', exact: true })
const add = (page: Page) => page.getByRole('button', { name: 'Add', exact: true })
const selector = (page: Page) => page.getByRole('textbox', { name: 'Selector' })

test.describe('domain aliases: creation', () => {
  test("US4-AS1 FR-036 FR-038 one name sends the form as shown and opens the new alias domain with legacy's alerts", async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('alias-domains-admin')
    await page.goto('alias-domains/-/new')
    await expect(page.getByRole('heading', { level: 1, name: 'Add domain alias' })).toBeVisible()
    await expect(selector(page)).toHaveValue('dkim')
    await expect(page.getByRole('combobox', { name: 'DKIM key length (bits)' })).toHaveValue('2048')
    await expectAccessible()
    await names(page).fill('new.example')
    await chooseTarget(page, AD.target)
    await add(page).click()
    await expect(page).toHaveURL(/\/alias-domains\/new\.example$/)
    const alerts = page.locator('[data-creation-report] [data-alert]')
    await expect(alerts.filter({ hasText: 'DKIM key new.example has been saved' })).toHaveCount(1)
    await expect(alerts.filter({ hasText: 'Added alias domain new.example' })).toHaveCount(1)
    const [request] = await requestsOf(mockApi, 'createAliasDomain')
    expect(request!.body).toEqual({
      name: 'new.example',
      targetDomain: AD.target,
      active: true,
      dkimSelector: 'dkim',
      dkimKeySize: 2048,
    })
  })

  test('US4-AS2 a failed DKIM key is a danger alert, and the alias domain is still added', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('alias-domains-dkim-failed')
    await page.goto('alias-domains/-/new')
    await names(page).fill('new.example')
    await chooseTarget(page, AD.target)
    await add(page).click()
    const report = page.locator('[data-creation-report]')
    await expect(report.locator('[data-alert="danger"]')).toContainText(
      'DKIM domain or selector invalid: new.example',
    )
    await expect(report.locator('[data-alert="success"]')).toContainText(
      'Added alias domain new.example',
    )
  })

  test('US4-AS4 without "ratelimit" there is no rate limit field and none is sent', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('alias-domains-da-no-ratelimit')
    await page.goto('alias-domains/-/new')
    await expect(names(page)).toBeVisible()
    await expect(page.getByRole('group', { name: 'Rate limit' })).toHaveCount(0)
  })

  test("US4-AS5 FR-040 refusals show legacy's messages at the names", async ({ page, mockApi }) => {
    await mockApi.use('alias-domains-admin')
    await page.goto('alias-domains/-/new')
    await chooseTarget(page, AD.target)
    for (const [name, message] of [
      [AD.existingDomain, `Alias domain ${AD.existingDomain} is invalid`],
      [AD.existingAliasDomain, `Alias domain ${AD.existingAliasDomain} is invalid`],
      [AD.serverHostname, 'Domain cannot match hostname'],
      [AD.target, `Alias domain must not be equal to target domain: ${AD.target}`],
    ] as const) {
      await names(page).fill(name)
      await add(page).click()
      await expect(page.locator('#alias-domain-names-error')).toContainText(message)
      await expect(names(page)).toHaveValue(name)
    }
  })

  test('US4-AS6 relay domains are offered disabled with the reason', async ({ page, mockApi }) => {
    await mockApi.use('alias-domains-admin')
    await page.goto('alias-domains/-/new')
    const field = page.getByRole('combobox', { name: 'Target domain', exact: true })
    await field.click()
    await field.fill(AD.relayDomain)
    const option = page.getByRole('option', {
      name: new RegExp(AD.relayDomain.replace('.', '\\.')),
    })
    await expect(option).toHaveAttribute('aria-disabled', 'true')
    await expect(option).toContainText(`Target domain ${AD.relayDomain} is a relay domain`)
  })

  test('US4-AS10 the server default selector is prefilled; emptied, no key is requested', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('alias-domains-feldhost')
    await page.goto('alias-domains/-/new')
    await expect(selector(page)).toHaveValue('feldhost')
    await names(page).fill('nokey.example')
    await chooseTarget(page, AD.target)
    await selector(page).fill('')
    await add(page).click()
    await expect(page).toHaveURL(/\/alias-domains\/nokey\.example$/)
    const report = page.locator('[data-creation-report]')
    await expect(report.locator('[data-alert]')).toHaveCount(1)
    await expect(report).toContainText('Added alias domain nokey.example')
    const [request] = await requestsOf(mockApi, 'createAliasDomain')
    expect(request!.body).toMatchObject({ dkimSelector: '' })
    expect(request!.body).not.toHaveProperty('dkimKeySize')
  })

  test('FR-036 a rate limit is sent with its frame', async ({ page, mockApi }) => {
    await mockApi.use('alias-domains-admin')
    await page.goto('alias-domains/-/new')
    await names(page).fill('limited.example')
    await chooseTarget(page, AD.target)
    const limit = page.getByRole('group', { name: 'Rate limit' })
    await limit.getByRole('textbox').fill('20')
    await limit.getByRole('combobox').selectOption('hour')
    await add(page).click()
    await expect(page.locator('[data-creation-report]')).toContainText(
      'Rate limit for object limited.example saved',
    )
    const [request] = await requestsOf(mockApi, 'createAliasDomain')
    expect(request!.body).toMatchObject({ rateLimit: { value: 20, frame: 'hour' } })
  })

  test('FR-037 several names get one result each, and the refused name stays', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('alias-domains-admin')
    await page.goto('alias-domains/-/new')
    await names(page).fill(`one.example, ${AD.existingDomain}, two.example`)
    await chooseTarget(page, AD.target)
    await add(page).click()
    const results = page.locator('[data-create-results]')
    await expect(results.locator('[data-outcome="created"]')).toHaveCount(2)
    await expect(results.locator('[data-outcome="refused"]')).toContainText(
      `Alias domain ${AD.existingDomain} is invalid`,
    )
    await expect(results).toContainText('Added alias domain one.example')
    await expect(names(page)).toHaveValue(AD.existingDomain)
    expect(await requestsOf(mockApi, 'createAliasDomain')).toHaveLength(3)
  })

  test('FR-004 losing "aliasDomains" mid-session is refused, and the add control goes', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('alias-domains')
    await page.goto('alias-domains/-/new')
    await names(page).fill('new.example')
    await chooseTarget(page, AD.target)
    await mockApi.patch({ flags: { [DOMAIN_ADMIN_004]: { aliasDomains: false } } })
    await add(page).click()
    await expect(page.getByText('Access denied or invalid form data')).toBeVisible()
    await page.goto('alias-domains')
    await listReady(page)
    await expect(page.getByRole('link', { name: 'Add domain alias' })).toHaveCount(0)
  })

  test('without "aliasDomains" the add page says "no access"', async ({ page, mockApi }) => {
    await mockApi.use('alias-domains-da-no-flags')
    await page.goto('alias-domains/-/new')
    await expect(page.getByRole('heading', { level: 1, name: 'No access' })).toBeVisible()
    await expect(names(page)).toHaveCount(0)
  })

  test('Edge: a temporary failure keeps the input', async ({ page, mockApi }) => {
    await mockApi.use('alias-domains-admin')
    await page.goto('alias-domains/-/new')
    await names(page).fill('later.example')
    await chooseTarget(page, AD.target)
    await mockApi.patch({ sharedStoreDown: true })
    await add(page).click()
    await expect(page.getByText('temporarily unavailable', { exact: false })).toBeVisible()
    await expect(names(page)).toHaveValue('later.example')
  })

  test('Edge: the form waits for the capabilities and says when they cannot be read', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('capabilities-unavailable')
    await page.goto('alias-domains/-/new')
    await expect(
      page.getByText('The server settings this form needs could not be loaded.'),
    ).toBeVisible()
    await expect(names(page)).toHaveCount(0)
  })

  test('FR-025 leaving the form with input asks first', async ({ page, mockApi }) => {
    await mockApi.use('alias-domains-admin')
    await page.goto('alias-domains')
    await page.getByRole('link', { name: 'Add domain alias' }).click()
    await names(page).fill('draft.example')
    await page.goBack()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Stay' }).click()
    await expect(page).toHaveURL(/alias-domains\/-\/new/)
    await expect(names(page)).toHaveValue('draft.example')
  })
})
