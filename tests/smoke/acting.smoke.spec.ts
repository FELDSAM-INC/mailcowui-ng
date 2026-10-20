// UI007 T057: session-only writes; no seeded account metadata is changed.
import { expect, test, type Page } from '@playwright/test'
import { csrfToken, requireLocalStack } from './fixtures/account-api'
import { signIn } from './fixtures/domains-api'

async function restoreOwner(page: Page): Promise<void> {
  const ended = await page.request.delete('/api/v2/session/impersonation', {
    headers: { 'X-CSRF-Token': await csrfToken(page) },
  })
  expect(ended.status()).toBe(204)
  const identity = await page.request.get('/api/v2/me')
  expect(identity.status()).toBe(200)
  expect(((await identity.json()) as { data: { username: string } }).data.username).toBe('admin')
}

test('US2-AS1/AS3 admin acts as a mailbox on two screens and returns to the filtered list', async ({
  page,
  baseURL,
}) => {
  requireLocalStack(baseURL)
  await signIn(page, 'admin')
  try {
    await page.goto('mailboxes?q=alice')
    await page.getByRole('button', { name: 'Login alice@example.org', exact: true }).click()
    const banner = page.locator('[data-acting-banner]')
    await expect(banner).toContainText('alice@example.org')
    await expect(banner).toContainText('admin')
    await expect(page).toHaveURL(/\/account\/password$/)
    await expect(page.locator('main')).toContainText('Not available while acting as another user')
    await page.goto('account/mail-apps')
    await expect(page.locator('[data-mailbox-overview]')).toBeVisible()
    await expect(banner).toBeVisible()
    await page.locator('[data-acting-return]').click()
    await expect(page).toHaveURL(/\/mailboxes\?q=alice$/)
    await expect(banner).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: 'Login alice@example.org', exact: true }),
    ).toBeVisible()
  } finally {
    await restoreOwner(page)
  }
})

test('US2-AS5 admin acts as a domain administrator and returns to its list', async ({
  page,
  baseURL,
}) => {
  requireLocalStack(baseURL)
  await signIn(page, 'admin')
  try {
    await page.goto('administrators/domain-admins?q=reseller')
    await page.getByRole('button', { name: 'Actions for reseller', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Login reseller', exact: true }).click()
    await expect(page.locator('[data-acting-banner]')).toContainText('reseller')
    await expect(page.locator('[data-acting-banner]')).toContainText('domain administrator')
    await expect(page.getByRole('button', { name: 'Account menu of reseller' })).toBeVisible()
    await page.locator('[data-acting-return]').click()
    await expect(page).toHaveURL(/\/administrators\/domain-admins\?q=reseller$/)
    await expect(page.locator('[data-acting-banner]')).toHaveCount(0)
  } finally {
    await restoreOwner(page)
  }
})
