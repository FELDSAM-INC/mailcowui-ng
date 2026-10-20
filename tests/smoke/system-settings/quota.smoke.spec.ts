import { expect, test } from '@playwright/test'
import type { QuotaNotificationRecipients, QuotaNotificationSettings } from '@/api'
import { csrfToken, requireLocalStack } from '../fixtures/account-api'
import { admin, reseller } from '../fixtures/accounts'
import { expectHome, signIn, signOut } from '../fixtures/flows'

test('@013 @local-stack domain administrator reads its quota notification copies', async ({
  page,
  baseURL,
}) => {
  requireLocalStack(baseURL)
  await signIn(page, reseller.username, reseller.password)
  await expectHome(page, reseller.username)
  await page.goto('domains/example.org')
  await expect(page.locator('[data-quota-copies-view]')).toBeVisible()
  await expect(
    page.locator('#section-quota-copies').getByRole('link', { name: 'History' }),
  ).toHaveCount(0)
  await signOut(page)
})
test('@013 @local-stack administrator changes and restores domain copies and reads quota defaults', async ({
  page,
  baseURL,
}) => {
  requireLocalStack(baseURL)
  await signIn(page, admin.username, admin.password)
  await expectHome(page, admin.username)
  const endpoint = '/api/v2/domains/example.org/quota-notification-recipients'
  const read = async () => {
    const response = await page.request.get(endpoint)
    expect(response.status()).toBe(200)
    return ((await response.json()) as { data: QuotaNotificationRecipients }).data
  }
  const before = await read()
  try {
    await page.goto('domains/example.org')
    const section = page.locator('#section-quota-copies')
    await section.getByRole('button', { name: /^Edit / }).click()
    await page.locator('#quota-copies-recipients').fill('ui013-quota-smoke@example.org')
    await page.locator('#quota-copies-active').check()
    await section.getByRole('button', { name: 'Save changes', exact: true }).click()
    await expect(section.locator('[data-quota-copies-view]')).toContainText(
      'ui013-quota-smoke@example.org',
    )
    expect(await read()).toMatchObject({
      recipients: ['ui013-quota-smoke@example.org'],
      active: true,
    })
  } finally {
    const current = await read()
    const response = await page.request.patch(endpoint, {
      headers: {
        'X-CSRF-Token': await csrfToken(page),
        'If-Match': current.etag,
        'Content-Type': 'application/merge-patch+json',
      },
      data: { recipients: before.recipients, active: before.active },
    })
    expect(response.status(), 'Restore original isolated-stack quota copies').toBe(200)
    expect(((await response.json()) as { data: QuotaNotificationRecipients }).data).toEqual({
      ...before,
      etag: expect.any(String),
    })
  }
  const response = await page.request.get('/api/v2/settings/quota-notification')
  expect(response.status()).toBe(200)
  const quota = ((await response.json()) as { data: QuotaNotificationSettings }).data
  await page.goto('system/quota-notifications')
  await expect(page.locator('#section-notification-email')).toContainText(quota.sender)
  await expect(page.locator('[data-default-template]')).toHaveCount(
    quota.htmlTemplateIsDefault ? 1 : 0,
  )
  await signOut(page)
})
