// UI 011 US8 (T137, FR-075): the audit log filtered to this feature's targets, with its labels and
// the details as stored (API gap 8): state before and after, queue IDs with their results (a long
// list collapsed), changed ban settings and list entries, rules, and translated failure reasons.
import type { Locator, Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { expand, openDashboard } from './dashboard-helpers'

const wide = (page: Page) => (page.viewportSize()?.width ?? 0) >= 768

function records(page: Page): Locator {
  return wide(page)
    ? page.getByRole('table', { name: 'Audit records' }).locator('tbody > tr[data-record]')
    : page.getByRole('list', { name: 'Audit records' }).getByRole('listitem')
}

const summary = (page: Page) => page.getByText(/^Showing \d+ to \d+ of \d+ entries$/)

/** Opens a record's details and returns the region that holds them. */
async function details(page: Page, record: Locator, event: string): Promise<Locator> {
  await record.getByRole('button', { name: 'Show details' }).click()
  return page.getByRole('region', { name: `Details of ${event}` })
}

test.describe('operations history @operations', () => {
  test('US8-AS1 a container history shows actor, time, address, action, outcome and the states', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
  }) => {
    await mockApi.use('ops-audit-records')
    await page.goto('audit-log?targetType=container&targetId=sogo-mailcow')
    await expect(summary(page)).toHaveText('Showing 1 to 3 of 3 entries')
    const first = records(page).first()
    await expect(first).toContainText('Container restarted')
    await expect(first).toContainText('admin (Administrator)')
    await expect(first).toContainText('192.0.2.10')
    await expect(first).toContainText('Success')
    const region = await details(page, first, 'Container restarted')
    await expect(region).toContainText('stateBefore')
    await expect(region).toContainText('2026-10-18T07:00:00Z')
    await expect(region).toContainText('stateAfter')
    await expect(region).toContainText('2026-10-18T10:00:00Z')
    await expectAccessible()
    await expectNoHorizontalScroll()
  })

  test('US8-AS2 a queue deletion lists its queue IDs with results, a long one collapsed', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('ops-audit-records')
    await page.goto('audit-log?targetType=mailQueue')
    await expect(summary(page)).toHaveText('Showing 1 to 7 of 7 entries')
    const deletions = records(page).filter({ hasText: /Queued messages deleted/ })
    await expect(deletions).toHaveCount(2)
    const four = await details(page, deletions.first(), 'Queued messages deleted')
    await expect(four.getByText('4F2A03')).toBeVisible()
    await expect(four).toContainText('notFound')
    await expect(four.getByRole('button', { name: /^Show all/ })).toHaveCount(0)
    await deletions.first().getByRole('button', { name: 'Hide details' }).click()
    await deletions.nth(1).getByRole('button', { name: 'Show details' }).click()
    const showAll = page.getByRole('button', { name: 'Show all 400' })
    await expect(showAll).toBeVisible()
    await expectAccessible()
    await showAll.click()
    await expect(page.getByText('4F2B8F')).toBeVisible()
  })

  test('US8-AS3 a ban settings change shows the old and new ban time and the list changes', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('ops-audit-records')
    await page.goto('audit-log?targetType=fail2banSettings')
    await expect(summary(page)).toHaveText('Showing 1 to 1 of 1 entries')
    const record = records(page).first()
    await expect(record).toContainText('Fail2ban parameters changed')
    const region = await details(page, record, 'Fail2ban parameters changed')
    await expect(region).toContainText('banTime')
    await expect(region).toContainText('1800')
    await expect(region).toContainText('7200')
    await expect(region).toContainText('192.0.2.0/24')
    await expect(region).toContainText('198.51.100.0/24')
  })

  test('FR-075 rules records, translated failure reasons and the seven target types', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('ops-audit-records')
    await page.goto('audit-log?targetType=fail2banRules')
    await expect(summary(page)).toHaveText('Showing 1 to 2 of 2 entries')
    await expect(records(page).nth(1)).toContainText(
      'Default regex filters were not restored in time',
    )
    await page.goto('audit-log?targetType=container&targetId=clamd-mailcow')
    await expect(records(page).first()).toContainText(
      'The container service or Postfix reported an error',
    )
    await page.goto('audit-log?targetType=container&targetId=nginx-mailcow')
    await expect(records(page).first()).toContainText('Outcome unknown')
    const toggle = page.getByRole('button', { name: 'Filters', exact: true })
    if ((await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click()
    const options = await page
      .getByRole('form', { name: 'Filters' })
      .getByLabel('Target type')
      .locator('option')
      .allTextContents()
    expect(options).toEqual(
      expect.arrayContaining([
        'Container',
        'Mail queue',
        'Queued message',
        'Fail2ban parameters',
        'Regex filters',
        'Active ban',
        'Banlist ID',
      ]),
    )
    await expectAccessible()
  })

  test('FR-075 T141 History opens the audit log from a container card, the queue and Fail2ban', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('ops-audit-records')
    await openDashboard(page)
    const sogo = await expand(page, 'sogo-mailcow')
    await sogo.getByRole('link', { name: 'History' }).click()
    await expect(page).toHaveURL(/\/ng\/audit-log\?targetType=container&targetId=sogo-mailcow$/)
    await expect(summary(page)).toHaveText('Showing 1 to 3 of 3 entries')

    await page.goto('operations/mail-queue')
    await page.getByRole('link', { name: 'History' }).click()
    await expect(page).toHaveURL(/\/ng\/audit-log\?targetType=mailQueue$/)
    await expect(summary(page)).toHaveText('Showing 1 to 7 of 7 entries')

    await page.goto('operations/fail2ban')
    const links = page.getByRole('link', { name: 'History' })
    await expect(links).toHaveCount(2)
    await links.first().click()
    await expect(page).toHaveURL(/\/ng\/audit-log\?targetType=fail2banSettings$/)
    await page.goBack()
    await page.getByRole('link', { name: 'History' }).nth(1).click()
    await expect(page).toHaveURL(/\/ng\/audit-log\?targetType=fail2banRules$/)
    await expect(summary(page)).toHaveText('Showing 1 to 2 of 2 entries')
  })
})
