// UI 012 US5, adding an OAuth2 client (T078), mirroring the classic "addOAuth2ClientModal": one
// Redirect URI field (several URIs separated by spaces) and "Add". The new secret is shown once in
// the one-time secret dialog; afterwards it appears nowhere.
import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { listReady, stubClipboard } from './helpers'

const SECRET = /^[0-9a-f]{24}$/
const secretDialog = (page: Page) => page.getByRole('dialog', { name: 'Add OAuth2 client' })

async function openForm(page: Page) {
  await page.goto('identity-providers/oauth2-apps')
  await listReady(page)
  await page.getByRole('link', { name: 'Add OAuth2 client' }).first().click()
  await expect(page.getByRole('heading', { level: 1, name: 'Add OAuth2 client' })).toBeVisible()
}

test.describe('add an OAuth2 client', () => {
  test('US5-AS3 FR-058 an empty field, a relative URI and a fragment are marked, and nothing is sent', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('oauth2-empty')
    await openForm(page)
    const field = page.getByRole('textbox', { name: /Redirect URI/ })
    const add = page.getByRole('button', { name: 'Add', exact: true })
    await add.click()
    await expect(page.getByText('Redirect/Callback URL cannot be empty')).toBeVisible()
    await expect(field).toHaveAttribute('aria-invalid', 'true')
    await field.fill('/oauth/callback https://wiki.example.org/cb#frag')
    await add.click()
    await expect(page.getByText(/^\/oauth\/callback: Enter an absolute URI/)).toBeVisible()
    await expect(
      page.getByText(/^https:\/\/wiki\.example\.org\/cb#frag: Enter an absolute URI/),
    ).toBeVisible()
    await expectAccessible()
    const created = (await mockApi.requests()).filter((r) => r.operationId === 'createOauth2Client')
    expect(created).toEqual([])
  })

  test('US5-AS2 FR-059 SC-008 the secret is shown once with the client ID, and appears nowhere afterwards', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
  }) => {
    await mockApi.use('oauth2-empty')
    await stubClipboard(page)
    await openForm(page)
    await page
      .getByRole('textbox', { name: /Redirect URI/ })
      .fill('https://wiki.example.org/oauth/callback')
    await page.getByRole('button', { name: 'Add', exact: true }).click()

    const dialog = secretDialog(page)
    await expect(dialog).toBeVisible()
    const secret = await dialog.getByRole('textbox', { name: 'Secret' }).inputValue()
    expect(secret).toMatch(SECRET)
    const [request] = (await mockApi.requests()).filter(
      (r) => r.operationId === 'createOauth2Client',
    )
    expect(request?.body).toEqual({ redirectUris: ['https://wiki.example.org/oauth/callback'] })
    await expect(dialog).toContainText(/Client ID: [0-9a-f]{12}/)
    await expect(dialog).toContainText('This secret is shown only once. It cannot be shown again.')
    await expect(page.getByText('Added client access')).toBeAttached()
    await expectAccessible()
    await expectNoHorizontalScroll()

    // Closing without copying asks first; Escape does too.
    await page.keyboard.press('Escape')
    const ask = page.getByRole('alertdialog', { name: 'Have you saved the secret?' })
    await expect(ask).toBeVisible()
    await ask.getByRole('button', { name: 'Back to the secret' }).click()
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Copy' }).click()
    await expect(dialog.getByRole('status')).toContainText('Copied to the clipboard.')
    expect(await page.evaluate(() => (window as unknown as { __copied?: string }).__copied)).toBe(
      secret,
    )
    await dialog.getByRole('button', { name: 'Close' }).click()
    await expect(dialog).toHaveCount(0)

    await expect(page).toHaveURL(/\/ng\/identity-providers\/oauth2-apps$/)
    await listReady(page)
    await expect(page.locator('[data-entry="1"]')).toContainText(
      'https://wiki.example.org/oauth/callback',
    )
    await expect(page.locator('body')).not.toContainText(secret)
    await page.goto('identity-providers/oauth2-apps/1')
    await expect(page.getByRole('heading', { level: 1, name: 'OAuth2' })).toBeVisible()
    await expect(page.locator('body')).not.toContainText(secret)
  })

  test('Edge: clipboard refused selects the secret with an explanation', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('oauth2-empty')
    await stubClipboard(page, true)
    await openForm(page)
    await page.getByRole('textbox', { name: /Redirect URI/ }).fill('com.example.app:/callback')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    const dialog = secretDialog(page)
    await dialog.getByRole('button', { name: 'Copy' }).click()
    await expect(dialog.getByRole('alert')).toContainText('The browser did not allow copying.')
    await expect(dialog.getByRole('textbox', { name: 'Secret' })).toBeFocused()
  })

  test('Edge: leaving while the secret is shown asks first; a reload loses the secret', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('oauth2-empty')
    await openForm(page)
    await page
      .getByRole('textbox', { name: /Redirect URI/ })
      .fill('https://a.example.org/cb https://b.example.org/cb')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    const dialog = secretDialog(page)
    const secret = await dialog.getByRole('textbox', { name: 'Secret' }).inputValue()
    await page.goBack()
    const ask = page.getByRole('alertdialog', { name: 'Have you saved the secret?' })
    await expect(ask).toBeVisible()
    await ask.getByRole('button', { name: 'Back to the secret' }).click()
    await expect(dialog).toBeVisible()
    await expect(page).toHaveURL(/oauth2-apps\/new$/)

    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: 'Add OAuth2 client' })).toBeVisible()
    await expect(page.locator('body')).not.toContainText(secret)
    const [request] = (await mockApi.requests()).filter(
      (r) => r.operationId === 'createOauth2Client',
    )
    expect(request?.body).toEqual({
      redirectUris: ['https://a.example.org/cb', 'https://b.example.org/cb'],
    })
  })
})
