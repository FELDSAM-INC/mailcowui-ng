// UI 005 T052/T076: second-factor and app-password changes against the real API. Existing seeded
// credentials stay available and every newly created test entry is removed.
import { expect, test } from '@playwright/test'

import type { OwnSecondFactor } from '@/api'

import { freshTotp } from '../support/totp'
import { csrfToken, requireLocalStack, signInAlice } from './fixtures/account-api'
import { alice } from './fixtures/accounts'
import {
  appPasswordPath,
  listAppPasswords,
  removeSmokeAppPasswords,
} from './fixtures/app-passwords-api'
import { uniqueName } from './fixtures/domains-api'
import { signOut } from './fixtures/flows'

test('@005 @local-stack US2-AS1 US2-AS2 US2-AS6 alice adds and removes a second authenticator', async ({
  page,
  baseURL,
}) => {
  test.setTimeout(180_000)
  requireLocalStack(baseURL)
  await signInAlice(page)
  const name = uniqueName('Smoke authenticator')
  try {
    await page.goto('account/two-factor')
    await expect(page.locator('[data-second-factors]')).toContainText('Used for this sign-in')
    await page.goto('account/two-factor/add/totp')
    const shown = page.locator('[data-grouped-secret]')
    await expect(shown).toBeVisible()
    const secret = (await shown.innerText()).replace(/[\s,]/g, '')
    expect(/^[A-Z2-7]{32}$/.test(secret)).toBe(true)
    await page.getByLabel('An identifier for your key').fill(name)
    await page.getByLabel('Current password (confirm changes)').fill(alice.password)
    await page.getByLabel('Six-digit code').fill(await freshTotp(secret))
    await page.getByRole('button', { name: 'Confirm', exact: true }).click()
    await expect(page).toHaveURL(/\/account\/two-factor$/)
    const added = page.locator('[data-second-factors] > li').filter({ hasText: name })
    await expect(added).toBeVisible()
    await expect(page.locator('[data-grouped-secret]')).toHaveCount(0)
    await added.getByRole('button', { name: `Remove: ${name}`, exact: true }).click()
    const confirm = page.getByRole('alertdialog')
    await expect(confirm.locator('input[type="password"]')).toHaveCount(0)
    await confirm.getByRole('button', { name: 'Remove', exact: true }).click()
    await expect(added).toHaveCount(0)
    await expect(page.locator('[data-second-factors]')).toContainText('Used for this sign-in')
  } finally {
    const response = await page.request.get('/api/v2/me/second-factors')
    expect(response.status()).toBe(200)
    const { data } = (await response.json()) as { data: OwnSecondFactor[] }
    for (const factor of data.filter((item) => item.name === name)) {
      const removed = await page.request.delete(`/api/v2/me/second-factors/${factor.id}`, {
        headers: { 'X-CSRF-Token': await csrfToken(page) },
      })
      expect(removed.status(), 'Remove the smoke authenticator').toBe(204)
    }
  }
  await signOut(page)
})

test('@005 @local-stack US4-AS2 US4-AS3 US4-AS5 alice creates a one-time app password and deletes it', async ({
  page,
  baseURL,
}) => {
  test.setTimeout(90_000)
  requireLocalStack(baseURL)
  await signInAlice(page)
  const name = uniqueName('Smoke')
  try {
    await page.goto('account/app-passwords')
    await expect(page.getByRole('heading', { name: 'App passwords', exact: true })).toBeVisible()
    await page.getByRole('link', { name: 'Create app password' }).click()
    await expect(page.getByRole('heading', { name: 'Add app password', exact: true })).toBeVisible()
    await page.getByLabel('App name', { exact: true }).fill(name)
    await page.getByLabel('Allowed protocols for app password').selectOption(['imap', 'smtp'])
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    const secretDialog = page.getByRole('dialog', { name: 'App password', exact: true })
    await expect(secretDialog).toContainText(alice.username)
    const secret = await secretDialog.getByLabel('Secret', { exact: true }).inputValue()
    expect(secret.length).toBe(32)
    await expect(secretDialog.locator('[data-grouped-secret] > span:not(.sr-only)')).toHaveCount(8)
    const created = (await listAppPasswords(page, alice.username)).find(
      (entry) => entry.name === name,
    )
    expect(created).toMatchObject({
      mailbox: alice.username,
      protocols: ['imap', 'smtp'],
      active: true,
    })
    expect(created).toBeDefined()

    await secretDialog.getByRole('button', { name: 'Close', exact: true }).click()
    await page
      .getByRole('alertdialog', { name: 'Have you saved the secret?' })
      .getByRole('button', { name: 'Yes, I have saved it', exact: true })
      .click()
    await expect(page).toHaveURL(new RegExp(`/account/app-passwords/${created!.id}$`))
    await expect(secretDialog).toHaveCount(0)
    await page.reload()
    await expect(page.getByLabel('App name', { exact: true })).toHaveValue(name)
    await expect(page.getByLabel('Secret', { exact: true })).toHaveCount(0)
    const read = await page.request.get(`${appPasswordPath(alice.username)}/${created!.id}`)
    expect(read.status()).toBe(200)
    const readBody: unknown = await read.json()
    expect(JSON.stringify(readBody).includes(secret), 'A later read never returns the secret').toBe(
      false,
    )
    const browserState = await page.evaluate(() =>
      JSON.stringify({
        local: { ...localStorage },
        session: { ...sessionStorage },
        history: history.state,
      }),
    )
    expect(browserState.includes(secret), 'No app password is persisted in browser storage').toBe(
      false,
    )

    await page.goto('account/app-passwords')
    const row = page.locator(`[data-entry="${created!.id}"]`)
    await expect(row).toContainText(name)
    await expect(row).toContainText('IMAP, SMTP')
    expect((await page.locator('body').innerText()).includes(secret)).toBe(false)
    await row.getByRole('button', { name: `Remove: ${name}`, exact: true }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete now' }).click()
    await expect(row).toHaveCount(0)
    const removed = await page.request.get(`${appPasswordPath(alice.username)}/${created!.id}`)
    expect(removed.status()).toBe(404)
  } finally {
    await removeSmokeAppPasswords(page, alice.username, name)
  }
  await signOut(page)
})
