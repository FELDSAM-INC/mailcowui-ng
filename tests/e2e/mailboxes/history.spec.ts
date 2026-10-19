// UI 003 US9, the history of a mailbox (T119): History on the mailbox page opens UI 001's audit
// log filtered to the mailbox, with the mailbox event labels and the detail members labelled; the
// rename is recorded under the previous address, as API 003 writes it; a domain administrator, who
// may not open the audit log, is not offered it.
import type { Locator, Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'

const wide = (page: Page) => (page.viewportSize()?.width ?? 0) >= 768

function records(page: Page): Locator {
  return wide(page)
    ? page.getByRole('table', { name: 'Audit records' }).locator('tbody > tr[data-record]')
    : page.getByRole('list', { name: 'Audit records' }).getByRole('listitem')
}

test.describe('mailbox history', () => {
  test('US9-AS1 FR-064 History opens the mailbox’s records with the labelled details', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('admin-history')
    await page.goto('mailboxes/anna@a.example')
    await page.getByRole('link', { name: 'History', exact: true }).click()
    await expect(page).toHaveURL(
      /\/ng\/audit-log\?targetId=anna%40a\.example|targetId=anna@a\.example/,
    )
    await expect(records(page)).toHaveCount(4)
    await expect(records(page).first()).toContainText('Mailbox changed')
    const password = records(page).nth(2)
    await password.getByRole('button', { name: 'Show details' }).click()
    const details = page.getByRole('region', { name: /Details of/ }).first()
    await expect(details).toContainText('Password set')
    await expect(details).toContainText('Pre-hashed password')
    await expectAccessible()
  })

  test('US9-AS2 the refused change shows the failure and its reason; the rename, under the previous address, both addresses', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('admin-history')
    await page.goto('audit-log?targetId=anna@a.example')
    const refused = records(page).nth(1)
    await expect(refused).toContainText('Failure')
    await expect(refused).toContainText('Change not permitted')
    await expect(records(page).filter({ hasText: 'Mailbox renamed' })).toHaveCount(0)
    await page.goto('audit-log?targetType=mailbox&targetId=anna.old@a.example')
    await expect(records(page)).toHaveCount(1)
    const rename = records(page).first()
    await expect(rename).toContainText('Mailbox renamed')
    await rename.getByRole('button', { name: 'Show details' }).click()
    const details = page.getByRole('region', { name: /Details of/ }).first()
    await expect(details).toContainText('Previous address')
    await expect(details).toContainText('anna.old@a.example')
    await expect(details).toContainText('New address')
    await expect(details).toContainText('anna@a.example')
    await expect(details).toContainText('Create alias automatically')
  })

  test('US9-AS3 a domain administrator has no History on the mailbox page', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('domain-admin-history')
    await page.goto('mailboxes/anna@a.example')
    await expect(page.getByRole('heading', { level: 1, name: 'Edit mailbox' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'History', exact: true })).toHaveCount(0)
  })
})
