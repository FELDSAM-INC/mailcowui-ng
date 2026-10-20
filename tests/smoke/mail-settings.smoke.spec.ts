import { expect, test } from '@playwright/test'
import type { MailboxMailSettings } from '@/api'
import { csrfToken, requireLocalStack, signInAlice } from './fixtures/account-api'
import { alice } from './fixtures/accounts'
import { signOut } from './fixtures/flows'

test('@005 @local-stack US7 alice changes tagged-mail handling and restores it', async ({
  page,
  baseURL,
}) => {
  test.setTimeout(90_000)
  requireLocalStack(baseURL)
  await signInAlice(page)
  const path = `/api/v2/mailboxes/${encodeURIComponent(alice.username)}/mail-settings`
  const read = async () => {
    const response = await page.request.get(path)
    expect(response.status()).toBe(200)
    return ((await response.json()) as { data: MailboxMailSettings }).data
  }
  const original = await read()
  const next = original.taggedMailHandling === 'subfolder' ? 'subject' : 'subfolder'
  try {
    await page.goto('account/mail-settings')
    await page.locator(`[data-value="${next}"]`).click()
    await expect(page.locator(`[data-value="${next}"]`)).toHaveAttribute('aria-pressed', 'true')
    expect((await read()).taggedMailHandling).toBe(next)
    await page.locator(`[data-value="${original.taggedMailHandling}"]`).click()
    await expect(page.locator(`[data-value="${original.taggedMailHandling}"]`)).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect((await read()).taggedMailHandling).toBe(original.taggedMailHandling)
  } finally {
    const latest = await read()
    if (latest.taggedMailHandling !== original.taggedMailHandling) {
      const restored = await page.request.patch(path, {
        headers: {
          'Content-Type': 'application/merge-patch+json',
          'X-CSRF-Token': await csrfToken(page),
          'If-Match': latest.etag,
        },
        data: { taggedMailHandling: original.taggedMailHandling },
      })
      expect(restored.status(), 'Restore the seeded mailbox setting').toBe(200)
    }
  }
  await signOut(page)
})
