// The mailbox screens opened directly, without visiting another feature first, show their texts
// and never a raw translation key (the feature strings load with their routes; the strings that
// several features share live in the main bundle, docs/conventions.md "New strings").
import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'

const RAW_KEY =
  /\b(?:domains|domainTemplates|mailboxes|mailboxTemplates|lists|bulk|common|sections|validation)\.[a-zA-Z]+\.?[a-zA-Z]*/

async function expectNoRawKeys(page: Page) {
  const text = await page.locator('main').innerText()
  expect(text.match(RAW_KEY)?.[0] ?? null).toBeNull()
}

test.describe('mailbox screens opened directly', () => {
  test('the list, the mailbox page with its sections and the rename tab show no raw keys', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('admin-edit')
    await page.goto('mailboxes/anna@a.example')
    await expect(page.getByRole('heading', { level: 1, name: 'Edit mailbox' })).toBeVisible()
    await expect(page.locator('#section-acl')).toBeVisible()
    await page.locator('#section-rename').getByLabel('I have created a backup.').check()
    await expectNoRawKeys(page)
    await page.goto('mailboxes')
    await expect(page.locator('[data-list-state="ready"]')).toBeVisible()
    await expectNoRawKeys(page)
  })

  test('the template list, a template and the add form show no raw keys', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('admin-templates')
    await page.goto('mailbox-templates')
    await expect(page.locator('[data-list-state="ready"]')).toBeVisible()
    await expectNoRawKeys(page)
    await page.goto('mailbox-templates/1')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expectNoRawKeys(page)
    await page.goto('mailbox-templates/new')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expectNoRawKeys(page)
  })
})
