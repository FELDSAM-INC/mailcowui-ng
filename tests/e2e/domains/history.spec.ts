// UI 002 US8, the history of a domain and of a template (T096, FR-063, research D26): History opens
// UI 001's audit log filtered by the object, with the translated event labels, targets and
// reasons; a domain administrator, who may not open the audit log, is never offered it.
import type { Locator, Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'

const wide = (page: Page) => (page.viewportSize()?.width ?? 0) >= 768

function records(page: Page): Locator {
  return wide(page)
    ? page.getByRole('table', { name: 'Audit records' }).locator('tbody > tr[data-record]')
    : page.getByRole('list', { name: 'Audit records' }).getByRole('listitem')
}

const summary = (page: Page) => page.getByText(/^Showing \d+ to \d+ of \d+ entries$/)

test.describe('history', () => {
  test('US8-AS1 History on example.org opens its records, the quota edit with actor, time, address and details', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('audit-domain-records')
    await page.goto('domains/example.org')
    await page.getByRole('link', { name: 'History' }).click()
    await expect(page).toHaveURL(/\/ng\/audit-log\?targetId=example\.org$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Audit log' })).toBeVisible()
    await expect(summary(page)).toHaveText('Showing 1 to 4 of 4 entries')
    const request = (await mockApi.requests()).findLast((r) => r.operationId === 'listAuditEvents')
    expect(request?.path).toContain('targetId=example.org')
    const quota = records(page).nth(2)
    await expect(quota).toContainText('Domain changed')
    await expect(quota).toContainText('admin (Administrator)')
    await expect(quota).toContainText('192.0.2.10')
    await expect(quota.locator('time')).toHaveAttribute('datetime', /Z$/)
    await quota.getByRole('button', { name: 'Show details' }).click()
    const details = page.getByRole('region', { name: /Details of/ }).first()
    await expect(details).toContainText('Domain')
    await expect(details).toContainText('example.org')
    await expect(details).toContainText('domainQuota')
    await expect(
      page.getByRole('button', { name: /Remove filter: Target: example\.org/ }),
    ).toBeVisible()
    await expectAccessible()
  })

  test('US8-AS2 the refused edit shows its translated reason; the footer update is in the history', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('audit-domain-records')
    await page.goto('audit-log?targetId=example.org')
    const refused = records(page).nth(1)
    await expect(refused).toContainText('Failure')
    await expect(refused).toContainText('Change not permitted')
    await expect(records(page).first()).toContainText('Domain footer changed')
    await expect(records(page).last()).toContainText('Domain added')
  })

  test('US8-AS3 a domain administrator has no History on the domain page', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('audit-domain-records-domain-admin')
    await page.goto('domains/example.org')
    await expect(page.getByRole('heading', { level: 1, name: 'Edit domain' })).toBeVisible()
    await expect(page.locator('#section-domain')).toBeVisible()
    await expect(page.getByRole('link', { name: 'History' })).toHaveCount(0)
  })

  test("FR-063 the template page's History opens the template's records", async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('audit-domain-records')
    await page.goto('domain-templates/2')
    await page.getByRole('link', { name: 'History' }).click()
    await expect(page).toHaveURL(/\/ng\/audit-log\?targetType=domainTemplate&targetId=2$/)
    await expect(summary(page)).toHaveText('Showing 1 to 2 of 2 entries')
    await expect(records(page).first()).toContainText('Domain template changed')
    await expect(records(page).last()).toContainText('Domain template added')
  })
})
