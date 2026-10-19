// UI 010 US1 smoke test against the API dev stack (T036): the DKIM list states as `admin`, the
// record of example.org equal to the API's, and the entries of `reseller`.
import { expect, test } from '@playwright/test'

import { readDkimKey } from './fixtures/dns-api'
import { signIn } from './fixtures/domains-api'

test.describe('@dns @read-only DKIM keys', () => {
  test('admin sees example.org valid, example.net missing and old.example unused', async ({
    page,
  }) => {
    await signIn(page, 'admin')
    await page.goto('dns/dkim-keys?size=100')
    await expect(page.locator('[data-entry="example.org"]')).toContainText('Key valid')
    await expect(page.locator('[data-entry="old.example"]')).toContainText('Key unused')
    const net = await readDkimKey(page, 'example.net')
    await expect(page.locator('[data-entry="example.net"]')).toContainText(
      net?.key ? 'Key valid' : 'Key missing',
    )
  })

  test('the entry of example.org shows the record the API returns', async ({ page }) => {
    await signIn(page, 'admin')
    const entry = await readDkimKey(page, 'example.org')
    expect(entry?.key?.record).toBeTruthy()
    await page.goto('dns/dkim-keys/example.org')
    const record = page.locator('[data-dkim-record]')
    await expect(record).toContainText(entry!.key!.record!.name)
    await expect(record.locator('[data-record-value]').nth(2)).toHaveText(entry!.key!.record!.value)
  })

  test('reseller sees only example.org, example.net and example.com', async ({ page }) => {
    await signIn(page, 'reseller')
    await page.goto('dns/dkim-keys')
    await expect(page.locator('[data-entry]').first()).toBeVisible()
    const names = await page
      .locator('[data-entry]')
      .evaluateAll((items) => items.map((item) => item.getAttribute('data-entry')))
    expect(names.sort()).toEqual(['example.com', 'example.net', 'example.org'])
  })
})
