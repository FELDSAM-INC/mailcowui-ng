// UI 010 US6 smoke test against the API dev stack (T092): with the default server setting,
// example.org's entry offers no export and says that it is turned off.
import { expect, test } from '@playwright/test'

import { signIn } from './fixtures/domains-api'

test.describe('@dns @read-only DKIM private key export', () => {
  test('export is turned off by default', async ({ page }) => {
    await signIn(page, 'admin')
    await page.goto('dns/dkim-keys/example.org')
    await expect(page.locator('[data-export-off]')).toContainText(
      'Private key export is turned off on this server.',
    )
    await expect(page.getByRole('button', { name: 'Private key' })).toHaveCount(0)
  })
})
