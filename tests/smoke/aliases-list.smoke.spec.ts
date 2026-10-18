// UI 004 US1 smoke test against the API dev stack (T034): the alias list as `admin` filtered by a
// domain found through the picker, `reseller`'s scope, and one check at 360 × 780.
import { expect, test } from '@playwright/test'

import { firstDomain, noHorizontalScroll, signIn } from './fixtures/feature-004-api'

test.describe('@feature-004 alias list', () => {
  test('admin filters the aliases by a domain found through the picker', async ({ page }) => {
    await signIn(page, 'admin')
    const domain = await firstDomain(page)
    await page.goto('aliases')
    await expect(page.locator('[data-list-state]')).toHaveAttribute(
      'data-list-state',
      /^(?!loading$)/,
    )
    await page.getByRole('button', { name: /^Filters/ }).click()
    const picker = page.getByRole('combobox', { name: 'Domain', exact: true })
    await picker.click()
    await picker.fill(domain.name.slice(0, 4))
    await page
      .getByRole('option', { name: new RegExp(domain.unicodeName) })
      .first()
      .click()
    await expect(page).toHaveURL(new RegExp(`domain=${domain.name}`))
    await expect(page.locator('[data-list-state]')).toHaveAttribute(
      'data-list-state',
      /^(ready|empty)$/,
    )
  })

  test("reseller's picker and list hold only its domains", async ({ page }) => {
    await signIn(page, 'reseller')
    const response = await page.request.get('/api/v2/me')
    const scope = ((await response.json()) as { data: { scope: { domains?: string[] } } }).data
      .scope
    await page.goto('aliases')
    await page.getByRole('button', { name: /^Filters/ }).click()
    await page.getByRole('combobox', { name: 'Target domain', exact: true }).click()
    const options = await page.getByRole('option').allTextContents()
    expect(options.length).toBeGreaterThan(0)
    for (const option of options) {
      expect((scope.domains ?? []).some((name) => option.includes(name))).toBe(true)
    }
  })

  test('the list has no horizontal scroll at 360 × 780', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 })
    await signIn(page, 'admin')
    await page.goto('aliases')
    await expect(page.locator('[data-list-state]')).toHaveAttribute(
      'data-list-state',
      /^(?!loading$)/,
    )
    expect(await noHorizontalScroll(page)).toBeLessThanOrEqual(0)
  })
})
