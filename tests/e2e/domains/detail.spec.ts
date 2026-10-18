// UI 002 US1, the domain page (T035), mirroring the classic page (docs/conventions.md "Detail
// pages"): legacy's edit heading with the name, the display-only usage figures and domain
// administrators with the list's labels, the Domain and Rate limit tabs as sections, units and
// locale, not found, loading and error, and the canonical address.
import { expect, test } from '../fixtures/test'

test.describe('domain page', () => {
  test('FR-015 the heading, the figures of the list and the Domain tab, compared with the mock', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
  }) => {
    await mockApi.use('domains-60')
    await page.goto('domains/nearly.example')
    await expect(page.getByRole('heading', { level: 1, name: 'Edit domain' })).toBeVisible()
    await expect(page.getByRole('main').locator('header')).toContainText('nearly.example')
    await expect(page.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0)
    const usage = page.locator('[data-usage-summary]')
    await expect(usage.getByRole('heading', { name: 'Statistics' })).toBeVisible()
    await expect(usage).toContainText('8 of 10')
    await expect(usage).toContainText('380 of 400')
    await expect(usage).toContainText('9.5 GiB of 10 GiB')
    await expect(usage).toContainText('7.3 GiB')
    await expect(usage).toContainText('12,345')
    await expect(usage).not.toContainText('Default mailbox size')
    await expect(usage.locator('[data-figure="maxMailboxQuota"]')).toContainText('2 GiB')
    for (const title of ['Edit domain', 'Rate limit']) {
      await expect(page.getByRole('heading', { level: 2, name: title })).toBeVisible()
    }
    const section = page.locator('#section-domain')
    await expect(section).toContainText('Nearly full')
    await expect(section).toContainText('Last modified')
    await expect(section).toContainText('400')
    await expect(section).toContainText('2,048')
    await expect(section).toContainText('10,240')
    await expect(section).not.toContainText('Default mailbox quota')
    const admins = page.locator('[data-domain-admins]')
    await expect(admins.getByRole('heading', { name: 'Domain administrators' })).toBeVisible()
    await expect(admins).toContainText('helper')
    await expect(admins).toContainText('reseller')
    await expect(page.locator('input:disabled')).toHaveCount(0)
    await expectAccessible()
    await expectNoHorizontalScroll()
  })

  test('FR-015 the relayhost in its legacy position, a vanished one by its ID, and the rate limit read-only', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('domains-60')
    await page.goto('domains/relayhost.example')
    await expect(page.locator('#section-domain')).toContainText('smtp.relay.example')
    await expect(page.locator('#section-ratelimit')).toContainText('10 msgs / hour')
    await page.goto('domains/orphan-relay.example')
    await expect(page.locator('#section-domain')).toContainText('ID 7')
    await page.goto('domains/footed.example')
    await expect(page.locator('#section-domain')).toContainText('Never')
  })

  test('FR-015 nothing of later features: no spam filter, quota warning BCC, MTA-STS or DNS', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('domains-60')
    await page.goto('domains/nearly.example')
    await expect(page.getByRole('heading', { level: 1, name: 'Edit domain' })).toBeVisible()
    for (const text of [/spam/i, /quota warning/i, /MTA-STS/, /DNS/]) {
      await expect(page.getByRole('main').getByText(text)).toHaveCount(0)
    }
  })

  test('FR-016 binary units, the locale and the device time zone', async ({ page, mockApi }) => {
    await mockApi.use('domains-60', {
      accounts: { admin: { preferences: { language: 'cs-cz', theme: 'system', etag: '"p"' } } },
    })
    await page.goto('domains/nearly.example')
    const usage = page.locator('[data-usage-summary]')
    await expect(usage).toContainText(/9,5\s?GiB/)
    await expect(usage).toContainText(/12\s345/)
  })

  test('US1-AS6 a domain outside the scope and an unknown domain show the same not-found page', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('domain-admin-two-of-ten')
    await page.goto('domains/domain-0003.example')
    await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
    const back = page.getByRole('main').getByRole('link', { name: 'Back to the domains' })
    await expect(back).toHaveAttribute('href', '/ng/domains')
    const outOfScope = await page.getByRole('main').textContent()
    await page.goto('domains/no-such-domain.example')
    await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
    expect(await page.getByRole('main').textContent()).toBe(outOfScope)
    await expectAccessible()
  })

  test('US1-AS6 the reseller sees no domain administrator list', async ({ page, mockApi }) => {
    await mockApi.use('domain-admin-two-of-ten')
    await page.goto('domains/customer-a.example')
    await expect(page.getByRole('heading', { level: 1, name: 'Edit domain' })).toBeVisible()
    await expect(page.locator('[data-domain-admins]')).toHaveCount(0)
  })

  test('FR-017 loading, and an error with retry', async ({ page, mockApi, expectAccessible }) => {
    await mockApi.use('domains-60', { delays: { getDomain: 1500 } })
    await page.goto('domains/nearly.example')
    await expect(page.locator('[data-page-loading]')).toBeVisible()
    await expect(page.getByRole('heading', { level: 1, name: 'Edit domain' })).toBeVisible()
    await mockApi.patch({ delays: { getDomain: 0 }, failures: { getDomain: { status: 500 } } })
    await page.goto('domains/customer-a.example')
    await expect(page.getByText('The domain could not be loaded.')).toBeVisible()
    await expectAccessible()
    await mockApi.patch({ failures: { getDomain: { status: 500, times: 0 } } })
    await page.getByRole('button', { name: 'Try again' }).click()
    await expect(page.locator('#section-domain')).toContainText('customer-a.example')
  })

  test('research D4 a readable or upper-case address is replaced by the canonical ASCII address', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('domains-60')
    await page.goto('domains/MÜNCHEN.de')
    await expect(page).toHaveURL(/\/ng\/domains\/xn--mnchen-3ya\.de$/)
    await expect(page.getByRole('main').locator('header')).toContainText(
      'münchen.de (xn--mnchen-3ya.de)',
    )
  })

  test('FR-078 names, tags and descriptions are shown as stored', async ({ page, mockApi }) => {
    await mockApi.use('domains-60')
    await page.goto('domains/customer-a.example')
    const section = page.locator('#section-domain')
    await expect(section).toContainText('Customer A')
    await expect(section).toContainText('customer-a')
    await expect(section).toContainText('gold')
  })
})
