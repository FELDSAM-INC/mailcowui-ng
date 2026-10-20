import { expect, test } from '@playwright/test'
import type { MailboxMailSettings } from '@/api'
import { csrfToken, requireLocalStack } from './fixtures/account-api'
import { alice } from './fixtures/accounts'
import { signIn } from './fixtures/domains-api'

test('@005 @local-stack US7 admin applies outbound TLS through the bulk quick action and restores it', async ({
  page,
  baseURL,
}) => {
  test.setTimeout(90_000)
  requireLocalStack(baseURL)
  await signIn(page, 'admin')
  const path = `/api/v2/mailboxes/${encodeURIComponent(alice.username)}/mail-settings`
  const read = async () => {
    const response = await page.request.get(path)
    expect(response.status()).toBe(200)
    return ((await response.json()) as { data: MailboxMailSettings }).data
  }
  const original = await read()
  try {
    await page.goto(`mailboxes?q=${encodeURIComponent(alice.username)}`)
    await page.getByRole('button', { name: 'Select', exact: true }).click()
    for (const enabled of [!original.tlsEnforceOutbound, original.tlsEnforceOutbound]) {
      await page.getByRole('checkbox', { name: `Select ${alice.username}`, exact: true }).check()
      await page.locator('[data-bulk-menu="tls-outbound"]').click()
      await page
        .locator(`[data-bulk-action="tls-outbound-${enabled ? 'activate' : 'deactivate'}"]`)
        .click()
      await expect(page.getByRole('region', { name: 'Results' })).toContainText('1 done')
      await expect(
        page.getByRole('checkbox', { name: `Select ${alice.username}`, exact: true }),
      ).not.toBeChecked()
      expect((await read()).tlsEnforceOutbound).toBe(enabled)
    }
  } finally {
    const latest = await read()
    if (latest.tlsEnforceOutbound !== original.tlsEnforceOutbound) {
      const restored = await page.request.patch(path, {
        headers: {
          'Content-Type': 'application/merge-patch+json',
          'X-CSRF-Token': await csrfToken(page),
          'If-Match': latest.etag,
        },
        data: { tlsEnforceOutbound: original.tlsEnforceOutbound },
      })
      expect(restored.status(), 'Restore seeded outbound TLS').toBe(200)
    }
  }
})
