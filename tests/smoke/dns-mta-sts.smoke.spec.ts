// UI 010 US4 smoke test against the API dev stack (T069): on example.net's domain page, set up a
// policy if none exists, otherwise change its mode; the identifier shown afterwards equals the
// one `GET /api/v2/mta-sts-policies/example.net` returns, and a renewed identifier is announced
// with the old and the new value.
import { expect, test } from '@playwright/test'

import { readPolicy } from './fixtures/dns-api'
import { signIn } from './fixtures/domains-api'

test.describe('@dns MTA-STS', () => {
  test('admin sets up or changes the policy of example.net', async ({ page }) => {
    await signIn(page, 'admin')
    const before = await readPolicy(page, 'example.net')
    await page.goto('domains/example.net')
    const section = page.locator('#mta-sts')
    await expect(section.getByRole('heading', { level: 2, name: 'MTA-STS' })).toBeVisible()
    await section.getByRole('button', { name: 'Edit MTA-STS' }).click()
    if (before) {
      const next = before.mode === 'enforce' ? 'testing' : 'enforce'
      await page.locator('#mta-sts-mode').selectOption(next)
    } else {
      await page.locator('#mta-sts-max-age').fill('86400')
    }
    await section.getByRole('button', { name: 'Save changes' }).click()
    await expect(section).toContainText('Changes to object example.net have been saved')
    const after = await readPolicy(page, 'example.net')
    expect(after).toBeTruthy()
    await expect(section.locator('[data-policy-id]')).toHaveText(after!.policyId)
    if (before && before.policyId !== after!.policyId) {
      const notice = section.locator('[data-policy-id-notice]')
      await expect(notice).toContainText(before.policyId)
      await expect(notice).toContainText(after!.policyId)
    }
  })
})
