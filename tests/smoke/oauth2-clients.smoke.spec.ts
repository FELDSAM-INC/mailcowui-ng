// UI 012 US5 smoke test (T083) against the real API: an administrator adds an OAuth2 client with
// the classic form and copies its secret, adds a second redirect URI on the client page, adds a
// second client, renews both secrets and revokes both clients' tokens with the quick actions, and
// removes both. Clients left behind by a failed run are removed through the API.
import { expect, test, type Page } from '@playwright/test'

import { signIn } from './fixtures/domains-api'

async function csrfToken(page: Page): Promise<string> {
  const response = await page.request.get('/api/v2/csrf-token')
  return ((await response.json()) as { data: { token: string } }).data.token
}

/** Removes a client if it still exists. */
async function deleteClient(page: Page, id: number): Promise<void> {
  const read = await page.request.get(`/api/v2/oauth2-clients/${id}`)
  if (read.status() === 404) return
  const { etag } = ((await read.json()) as { data: { etag: string } }).data
  await page.request.delete(`/api/v2/oauth2-clients/${id}`, {
    headers: { 'X-CSRF-Token': await csrfToken(page), 'If-Match': etag },
  })
}

async function addClient(page: Page, uri: string): Promise<number> {
  await page.goto('identity-providers/oauth2-apps/new')
  await page.getByRole('textbox', { name: /Redirect URI/ }).fill(uri)
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Add OAuth2 client' })
  await expect(dialog.getByRole('textbox', { name: 'Secret' })).toHaveValue(/^[0-9a-f]{24}$/)
  const clientId = /Client ID: ([0-9a-f]{12})/.exec((await dialog.textContent()) ?? '')![1]!
  await page.keyboard.press('Escape')
  await page
    .getByRole('alertdialog', { name: 'Have you saved the secret?' })
    .getByRole('button', { name: 'Yes, I have saved it' })
    .click()
  await expect(page).toHaveURL(/\/ng\/identity-providers\/oauth2-apps$/)
  await page.getByRole('searchbox', { name: 'Search:' }).fill(clientId)
  const row = page.locator('[data-entry]').filter({ hasText: clientId })
  await expect(row).toHaveCount(1)
  return Number(await row.getAttribute('data-entry'))
}

test.describe('@oauth2-clients', () => {
  test('admin adds, edits, renews, revokes and removes OAuth2 clients', async ({ page }) => {
    await signIn(page, 'admin')
    const ids: number[] = []
    try {
      ids.push(await addClient(page, 'https://wiki.example.org/oauth/callback'))
      await page.goto(`identity-providers/oauth2-apps/${ids[0]}`)
      await page.getByRole('button', { name: 'Edit OAuth2' }).click()
      await page
        .getByRole('textbox', { name: 'Redirect/Callback URL' })
        .fill('https://wiki.example.org/oauth/callback https://wiki.example.org/cb2')
      await page.getByRole('button', { name: 'Save changes' }).click()
      await expect(page.locator('#section-oauth2-client')).toContainText(
        'https://wiki.example.org/cb2',
      )
      ids.push(await addClient(page, 'com.example.smoke:/callback'))

      await page.goto('identity-providers/oauth2-apps?size=100')
      await page.getByRole('button', { name: 'Select', exact: true }).click()
      for (const id of ids) {
        await page.locator(`[data-entry="${id}"]`).getByRole('checkbox').check()
      }
      const bar = page.getByRole('region', { name: 'Bulk actions' })
      await bar.getByRole('button', { name: 'Generate new client secret' }).click()
      await page
        .getByRole('alertdialog')
        .getByRole('button', { name: 'Generate new client secret' })
        .click()
      const dialog = page.getByRole('dialog', { name: 'Generate new client secret' })
      for (let index = 0; index < ids.length; index++) {
        await expect(dialog.getByRole('textbox', { name: 'Secret' })).toHaveValue(/^[0-9a-f]{24}$/)
        await page.keyboard.press('Escape')
        await page
          .getByRole('alertdialog', { name: 'Have you saved the secret?' })
          .getByRole('button', { name: 'Yes, I have saved it' })
          .click()
      }
      const results = page.getByRole('region', { name: 'Results' })
      await expect(results.locator('li', { hasText: 'Done' })).toHaveCount(2)

      await bar.getByRole('button', { name: 'Revoke all client tokens' }).click()
      await page
        .getByRole('alertdialog')
        .getByRole('button', { name: 'Revoke all client tokens' })
        .click()
      await expect(results.locator('li', { hasText: 'Done' })).toHaveCount(2)

      await bar.getByRole('button', { name: 'Remove' }).click()
      const confirm = page.getByRole('alertdialog')
      await confirm.getByRole('textbox').fill('2')
      await confirm.getByRole('button', { name: 'Delete now' }).click()
      await expect(results.locator('li', { hasText: 'Done' })).toHaveCount(2)
      for (const id of ids) await expect(page.locator(`[data-entry="${id}"]`)).toHaveCount(0)
    } finally {
      for (const id of ids) await deleteClient(page, id)
    }
  })
})
