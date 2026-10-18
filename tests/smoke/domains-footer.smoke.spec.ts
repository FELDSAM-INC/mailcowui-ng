// UI 002 US7 smoke test (T091, research D29): a footer with a variable and an excluded mailbox is
// saved on example.org, read back, and the previous footer restored.
import { expect, test } from '@playwright/test'

import { signIn } from './fixtures/domains-api'

test.describe('@domains footer', () => {
  test('admin saves a footer on example.org and restores the previous one', async ({ page }) => {
    await signIn(page, 'admin')
    const read = await page.request.get('/api/v2/domains/example.org/footer')
    const previous = ((await read.json()) as { data: Record<string, unknown> }).data
    try {
      await page.goto('domains/example.org?edit=footer')
      const plain = page.getByLabel('PLAIN footer')
      await expect(plain).toBeVisible()
      await plain.fill('Sent by {= from_name =}')
      await page.getByLabel('Exclude from footer').selectOption(['a:alice@example.org'])
      await page
        .locator('#section-footer')
        .getByRole('button', { name: 'Save changes', exact: true })
        .click()
      await expect(page.locator('[data-live="polite"]')).toContainText(
        'Changes to domain footer example.org have been saved',
      )
      const after = await page.request.get('/api/v2/domains/example.org/footer')
      const saved = ((await after.json()) as { data: Record<string, unknown> }).data
      expect(saved).toMatchObject({
        plain: 'Sent by {= from_name =}',
        excludedAddresses: ['alice@example.org'],
      })
    } finally {
      const current = await page.request.get('/api/v2/domains/example.org/footer')
      const { etag } = ((await current.json()) as { data: { etag: string } }).data
      const token = await page.request.get('/api/v2/csrf-token')
      const csrf = ((await token.json()) as { data: { token: string } }).data.token
      await page.request.put('/api/v2/domains/example.org/footer', {
        headers: { 'X-CSRF-Token': csrf, 'If-Match': etag },
        data: {
          html: previous.html,
          plain: previous.plain,
          skipReplies: previous.skipReplies,
          excludedAddresses: previous.excludedAddresses,
          excludedAliasDomains: previous.excludedAliasDomains,
        },
      })
    }
  })
})
