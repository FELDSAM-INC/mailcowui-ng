// UI007 T036/T068/T076: every mutation belongs to a uniquely named disposable account.
import { expect, test, type Page } from '@playwright/test'
import type { Admin, DomainAdmin } from '@/api'
import { csrfToken, requireLocalStack } from './fixtures/account-api'
import { signIn, uniqueName } from './fixtures/domains-api'

async function removeCreated(page: Page, path: string, username: string): Promise<void> {
  const url = `/api/v2/${path}/${encodeURIComponent(username)}`
  const read = await page.request.get(url)
  if (read.status() === 404) return
  expect(read.status()).toBe(200)
  const item = ((await read.json()) as { data: Admin }).data
  const removed = await page.request.delete(url, {
    headers: { 'X-CSRF-Token': await csrfToken(page), 'If-Match': item.etag },
  })
  expect([204, 404]).toContain(removed.status())
}
for (const kind of ['admin', 'domainAdmin'] as const) {
  test(`${kind} creates, edits, deactivates, activates and removes a disposable account`, async ({
    page,
    baseURL,
  }) => {
    requireLocalStack(baseURL)
    const path = kind === 'admin' ? 'admins' : 'domain-admins',
      username = uniqueName(`smoke-${kind.toLowerCase()}`)
    await signIn(page, 'admin')
    try {
      await page.goto(`administrators/${path}/-/new`)
      await page.locator('input[name="accountUsername"]').fill(username)
      if (kind === 'domainAdmin') {
        await page.getByRole('combobox', { name: /Domain assignments/ }).fill('example.org')
        await page.getByRole('option', { name: 'example.org', exact: true }).click()
      }
      await page.locator('[data-generate]').click()
      await page.getByRole('button', { name: 'Add', exact: true }).click()
      await expect(page).toHaveURL(new RegExp(`/administrators/${path}/${username}$`))
      if (kind === 'domainAdmin') {
        await page
          .locator('#section-account')
          .getByRole('button', { name: /^Edit:/ })
          .click()
        await page.getByRole('combobox', { name: /Domains/ }).fill('example.net')
        await page.getByRole('option', { name: 'example.net', exact: true }).click()
        await page.getByRole('button', { name: 'Save changes', exact: true }).click()
        await expect(page).not.toHaveURL(/edit=/)
        await page
          .locator('#section-permissions')
          .getByRole('button', { name: /^Edit:/ })
          .click()
        const aliasDomains = page.locator('#account-permission-aliasDomains')
        if (!(await aliasDomains.isChecked())) await aliasDomains.click()
        await page.getByRole('button', { name: 'Save changes', exact: true }).click()
        await expect(page).not.toHaveURL(/edit=/)
        const read = await page.request.get(`/api/v2/domain-admins/${username}`)
        const account = ((await read.json()) as { data: DomainAdmin }).data
        expect(account.domains.map((domain) => domain.domain)).toEqual(
          expect.arrayContaining(['example.org', 'example.net']),
        )
        expect(account.permissions.aliasDomains).toBe(true)
      }
      await page.getByRole('button', { name: `Actions for ${username}` }).click()
      await page.getByRole('menuitem', { name: 'Deactivate', exact: true }).click()
      await page
        .getByRole('alertdialog')
        .getByRole('button', { name: 'Deactivate', exact: true })
        .click()
      await expect
        .poll(
          async () =>
            (
              (await (await page.request.get(`/api/v2/${path}/${username}`)).json()) as {
                data: Admin
              }
            ).data.active,
        )
        .toBe(false)
      await page.getByRole('button', { name: `Actions for ${username}` }).click()
      await page.getByRole('menuitem', { name: 'Activate', exact: true }).click()
      await expect
        .poll(
          async () =>
            (
              (await (await page.request.get(`/api/v2/${path}/${username}`)).json()) as {
                data: Admin
              }
            ).data.active,
        )
        .toBe(true)
      await page.getByRole('button', { name: `Actions for ${username}` }).click()
      await page.getByRole('menuitem', { name: 'Remove', exact: true }).click()
      await page.getByRole('button', { name: 'Delete now', exact: true }).click()
      await expect(page).toHaveURL(new RegExp(`/administrators/${path}$`))
      expect((await page.request.get(`/api/v2/${path}/${username}`)).status()).toBe(404)
    } finally {
      await removeCreated(page, path, username)
    }
  })
}
