// A disposable mailbox isolates write-only Pushover credentials from seeded accounts.
import { expect, test } from '@playwright/test'
import type { PushNotificationSettings } from '@/api'
import { requireLocalStack } from './fixtures/account-api'
import { signIn } from './fixtures/domains-api'
import {
  createMailbox,
  deleteMailbox,
  uniqueLocalPart,
  SMOKE_DOMAIN,
} from './fixtures/mailboxes-api'

test('@005 @local-stack US7 Pushover saves write-only credentials, verifies them and removes the configuration', async ({
  page,
  baseURL,
}) => {
  test.setTimeout(120_000)
  requireLocalStack(baseURL)
  await signIn(page, 'admin')
  const localPart = uniqueLocalPart()
  const address = `${localPart}@${SMOKE_DOMAIN}`
  await createMailbox(page, localPart)
  const path = `/api/v2/mailboxes/${encodeURIComponent(address)}/push-notifications`
  const read = async () => {
    const response = await page.request.get(path)
    expect(response.status()).toBe(200)
    return ((await response.json()) as { data: PushNotificationSettings }).data
  }
  try {
    expect((await read()).configured).toBe(false)
    await page.goto(`mailboxes/${address}/push-notifications`)
    const form = page.locator('[data-push-form]')
    await form.locator('input[name="token"]').fill('a'.repeat(30))
    await form.locator('input[name="userKey"]').fill('b'.repeat(30))
    await form.locator('input[name="title"]').fill('Disposable smoke notification')
    await form.getByRole('button', { name: 'Save changes', exact: true }).click()
    await expect(form.getByRole('status')).toContainText('Pushover')
    const settings = await read()
    expect(settings).toMatchObject({ configured: true, tokenSet: true, userKeySet: true })
    expect(settings).not.toHaveProperty('token')
    expect(settings).not.toHaveProperty('userKey')
    await expect(form.locator('input[name="token"]')).toHaveValue('')
    const verification = page.waitForResponse(
      (response) =>
        response.url().endsWith('/push-notifications/verification') &&
        response.request().method() === 'POST',
    )
    await form.getByRole('button', { name: 'Verify credentials' }).click()
    const response = await verification
    // These are deliberately invalid service credentials. The real service can reject them or
    // be unavailable; both responses must reach the user without exposing stored credentials.
    expect([200, 503]).toContain(response.status())
    if (response.status() === 200) {
      expect((await response.json()).data.accepted).toBe(false)
      await expect(form.getByRole('status').last()).toContainText('Pushover API ERR')
    } else await expect(form.getByRole('alert')).toContainText('Pushover')
    await form.getByRole('button', { name: 'Remove', exact: true }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Remove', exact: true }).click()
    await expect(form.getByRole('button', { name: 'Remove', exact: true })).toHaveCount(0)
    expect((await read()).configured).toBe(false)
  } finally {
    await deleteMailbox(page, address)
  }
})
