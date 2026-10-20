// UI 005 T076: real mailbox-context metadata and a real domain-administrator ACL. The temporary
// account is removed in finally, leaving the seeded reseller and app passwords unchanged.
import { expect, test } from '@playwright/test'

import type { DomainAdmin } from '@/api'

import { csrfToken, requireLocalStack } from './fixtures/account-api'
import { alice, SMOKE_DEFAULT_PASSWORD } from './fixtures/accounts'
import { appPasswordPath, listAppPasswords } from './fixtures/app-passwords-api'
import { signIn as signInAdministrator, uniqueName } from './fixtures/domains-api'
import { expectHome, signIn } from './fixtures/flows'

test('@005 @local-stack US4-AS3 admin sees the seeded mailbox app-password metadata', async ({
  page,
  baseURL,
}) => {
  requireLocalStack(baseURL)
  await signInAdministrator(page, 'admin')
  await page.goto(`mailboxes/${alice.username}`)
  await page.getByRole('link', { name: 'App passwords', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'App passwords', exact: true })).toBeVisible()
  await expect(page.getByRole('main')).toContainText(alice.username)
  const entries = await listAppPasswords(page, alice.username)
  const phone = entries.find((entry) => entry.name === 'Phone')
  const laptop = entries.find((entry) => entry.name === 'Old laptop')
  expect(phone).toMatchObject({ active: true })
  expect(laptop).toMatchObject({ active: false })
  await expect(page.locator(`[data-entry="${phone!.id}"]`)).toContainText('Phone')
  await expect(page.locator(`[data-entry="${laptop!.id}"]`)).toContainText('Inactive')
  await expect(page.getByRole('link', { name: 'Create app password' })).toBeVisible()
  await page.getByRole('link', { name: 'Edit: Phone', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'App password: Phone', exact: true }),
  ).toBeVisible()
  await expect(page.getByLabel('App name', { exact: true })).toHaveValue('Phone')
  await expect(page.getByLabel('Secret', { exact: true })).toHaveCount(0)
})

test('@005 @local-stack US4-AS7 a domain administrator without appPasswds can only read', async ({
  page,
  browser,
  baseURL,
}) => {
  requireLocalStack(baseURL)
  await signInAdministrator(page, 'admin')
  const username = uniqueName('smoke-app-reader')
  const uri = `/api/v2/domain-admins/${encodeURIComponent(username)}`
  const readerContext = await browser.newContext({
    baseURL,
    ignoreHTTPSErrors: process.env.SMOKE_IGNORE_HTTPS_ERRORS === '1',
  })
  const reader = await readerContext.newPage()
  try {
    const created = await page.request.post('/api/v2/domain-admins', {
      headers: { 'X-CSRF-Token': await csrfToken(page) },
      data: {
        username,
        password: SMOKE_DEFAULT_PASSWORD,
        domains: ['example.org'],
        permissions: { appPasswds: false },
      },
    })
    expect(created.status()).toBe(201)
    await signIn(reader, username, SMOKE_DEFAULT_PASSWORD, 'sign-in/domain-admin')
    await expectHome(reader, username)
    await reader.goto(`mailboxes/${alice.username}/app-passwords`)
    await expect(reader.locator('[data-acl-note]')).toContainText('Manage app passwords')
    await expect(reader.getByRole('link', { name: 'Create app password' })).toHaveCount(0)
    await expect(reader.getByRole('button', { name: /^Remove:/ })).toHaveCount(0)
    const entries = await listAppPasswords(reader, alice.username)
    const phone = entries.find((entry) => entry.name === 'Phone')
    expect(phone).toBeDefined()
    await reader.getByRole('link', { name: 'Edit: Phone', exact: true }).click()
    await expect(
      reader.getByRole('heading', { name: 'App password: Phone', exact: true }),
    ).toBeVisible()
    await expect(reader.getByRole('button', { name: 'generate', exact: true })).toHaveCount(0)
    await expect(reader.getByRole('button', { name: 'Save changes', exact: true })).toHaveCount(0)
    await expect(reader.locator('[data-app-password-form]')).toHaveCount(0)
    const denied = await reader.request.patch(`${appPasswordPath(alice.username)}/${phone!.id}`, {
      headers: {
        'X-CSRF-Token': await csrfToken(reader),
        'If-Match': phone!.etag,
        'Content-Type': 'application/merge-patch+json',
      },
      data: { name: 'Must not be saved' },
    })
    expect(denied.status()).toBe(403)
    expect((await denied.json()).requiredFlags).toContain('appPasswds')
    expect(
      (await listAppPasswords(page, alice.username)).find((entry) => entry.id === phone!.id)?.name,
    ).toBe('Phone')
  } finally {
    await readerContext.close()
    const current = await page.request.get(uri)
    if (current.status() !== 404) {
      expect(current.status()).toBe(200)
      const { etag } = ((await current.json()) as { data: DomainAdmin }).data
      const removed = await page.request.delete(uri, {
        headers: { 'X-CSRF-Token': await csrfToken(page), 'If-Match': etag },
      })
      expect(removed.status()).toBe(204)
    }
  }
})
