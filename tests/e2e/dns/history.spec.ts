// UI 010 US8, the history of DKIM keys and MTA-STS policies (T101, FR-070): History from an entry
// and from the MTA-STS section, the labels of the event and target types, refusals, no private key
// in the history, and no History for domain administrators.
import { expect, test } from '../fixtures/test'
import { FIRST_LOAD } from './helpers'

test.describe('DKIM and MTA-STS history', () => {
  test('US8-AS1 FR-070 History of example.org lists its DKIM records without any private key', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('dns-audit-records')
    await page.goto('dns/dkim-keys/example.org')
    await page.getByRole('link', { name: 'History' }).click({ timeout: FIRST_LOAD })
    await expect(page).toHaveURL(/audit-log\?targetType=dkimKey&targetId=example\.org/)
    const main = page.getByRole('main')
    await expect(main).toContainText('DKIM key imported', { timeout: FIRST_LOAD })
    await expect(main).toContainText('DKIM key generated')
    await expect(main).toContainText('DKIM private key exported')
    await expect(main).not.toContainText('PRIVATE KEY')
    await expectAccessible()
  })

  test('US8-AS2 History from the MTA-STS section shows the policy change', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('dns-audit-records')
    await page.goto('domains/example.org')
    const section = page.locator('#mta-sts')
    await section.getByRole('link', { name: 'History' }).click({ timeout: FIRST_LOAD })
    await expect(page).toHaveURL(/audit-log\?targetType=mtaStsPolicy&targetId=example\.org/)
    await expect(page.getByRole('main')).toContainText('MTA-STS policy changed', {
      timeout: FIRST_LOAD,
    })
  })

  test('FR-070 the target type filter offers the DKIM key and the MTA-STS policy', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('dns-audit-records')
    await page.goto('audit-log')
    const filters = page.getByRole('button', { name: /^Filters/ })
    await filters.click({ timeout: FIRST_LOAD })
    const select = page.getByLabel('Target type')
    await expect(select.locator('option', { hasText: 'DKIM key' })).toHaveCount(1)
    await expect(select.locator('option', { hasText: /^MTA-STS$/ })).toHaveCount(1)
  })

  test('US8-AS3 a domain administrator has no History on the entry or the section', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('dns-domain-admin')
    await page.goto('dns/dkim-keys/example.org')
    await expect(page.getByRole('heading', { level: 1, name: 'example.org' })).toBeVisible({
      timeout: FIRST_LOAD,
    })
    await expect(page.getByRole('link', { name: 'History' })).toHaveCount(0)
    await page.goto('domains/example.org')
    await expect(page.locator('#mta-sts')).toBeVisible({ timeout: FIRST_LOAD })
    await expect(page.locator('#mta-sts').getByRole('link', { name: 'History' })).toHaveCount(0)
  })
})
