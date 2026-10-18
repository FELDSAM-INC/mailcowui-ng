// UI 002 US1 smoke test against the API dev stack (T037, research D29): the list and the domain
// page as `admin` and as `reseller`, and one check at 360 × 780.
import { expect, test } from '@playwright/test'

import { signIn } from './fixtures/domains-api'

test.describe('@domains browse', () => {
  test('admin sees example.org and example.net, and the usage of example.org', async ({ page }) => {
    await signIn(page, 'admin')
    await page.goto('domains')
    await expect(page.locator('[data-entry="example.org"]')).toBeVisible()
    await expect(page.locator('[data-entry="example.net"]')).toBeVisible()
    await page.goto('domains/example.org')
    await expect(page.getByRole('heading', { level: 1, name: 'Edit domain' })).toBeVisible()
    await expect(page.getByRole('main').locator('header')).toContainText('example.org')
    await expect(page.locator('[data-usage-summary] [data-usage="mailboxes"]')).toContainText(
      /1 of/,
    )
  })

  test('reseller sees exactly its two domains, without the domain administrator list', async ({
    page,
  }) => {
    await signIn(page, 'reseller')
    await page.goto('domains')
    const names = await page
      .locator('[data-entry]')
      .evaluateAll((items) => items.map((item) => item.getAttribute('data-entry')))
    expect(names.sort()).toEqual(['example.net', 'example.org'])
    await page.goto('domains/example.org')
    await expect(page.locator('[data-domain-admins]')).toHaveCount(0)
  })

  test('the list has no horizontal scroll at 360 × 780', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 })
    await signIn(page, 'admin')
    await page.goto('domains')
    await expect(page.locator('[data-entry]').first()).toBeVisible()
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })
})
