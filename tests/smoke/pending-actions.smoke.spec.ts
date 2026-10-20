// UI 005 T042: a forced password change is completed in the app against the real API.
import { expect, test } from '@playwright/test'

import { requireLocalStack, restoreMailbox } from './fixtures/account-api'
import { bob } from './fixtures/accounts'
import { signIn as signInAdministrator } from './fixtures/domains-api'
import { expectHome, signIn, signOut } from './fixtures/flows'
import { readMailbox } from './fixtures/mailboxes-api'

test('@005 @local-stack US1-AS5 bob completes the forced password change and signs in with it', async ({
  page,
  browser,
  baseURL,
}) => {
  requireLocalStack(baseURL)
  const administratorContext = await browser.newContext({
    baseURL,
    ignoreHTTPSErrors: process.env.SMOKE_IGNORE_HTTPS_ERRORS === '1',
  })
  const administrator = await administratorContext.newPage()
  await signInAdministrator(administrator, 'admin')
  const before = await readMailbox(administrator, bob.username)
  try {
    expect(before.forcePasswordChange).toBe(true)
    await signIn(page, bob.username, bob.password)
    await expect(page.getByRole('heading', { level: 1, name: 'Actions required' })).toBeVisible()
    await expect(page.getByRole('link', { name: /classic interface/ })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Check again' })).toHaveCount(0)
    const form = page.locator('[data-forced-password]')
    await expect(form.locator('[autocomplete="current-password"]')).toHaveCount(0)
    const next = 'Smoke-forced-change-7q'
    await form.getByLabel('New password', { exact: true }).fill(next)
    await form.getByLabel('Confirmation password (repeat)').fill(next)
    await form.getByRole('button', { name: 'Save changes' }).click()
    await expectHome(page, bob.username)
    expect((await readMailbox(administrator, bob.username)).forcePasswordChange).toBe(false)
    await signOut(page)
    await signIn(page, bob.username, next)
    await expectHome(page, bob.username)
    await signOut(page)
  } finally {
    await restoreMailbox(administrator, bob.username, {
      password: bob.password,
      forcePasswordChange: before.forcePasswordChange,
    })
    await administratorContext.close()
  }
})
