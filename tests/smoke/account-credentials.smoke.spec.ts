// UI 005 T042/T065: actual password writes, sign-ins and a delivered recovery link. The
// administrator fallback restores the seeded credentials and recovery address on every exit.
import { expect, test } from '@playwright/test'

import { freshTotp } from '../support/totp'
import {
  changePassword,
  requireLocalStack,
  restoreMailbox,
  signInAlice,
} from './fixtures/account-api'
import { alice } from './fixtures/accounts'
import { signIn as signInAdministrator, uniqueName } from './fixtures/domains-api'
import { signOut } from './fixtures/flows'
import { readMailbox } from './fixtures/mailboxes-api'
import { resetLink } from './fixtures/reset-token'

test.describe.serial('@005 @local-stack account credentials', () => {
  test.setTimeout(180_000)

  test('US1-AS1 alice changes her password, signs in with it and restores the old one', async ({
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
    try {
      await signInAlice(page)
      const next = 'Smoke-own-password-7q'
      await changePassword(page, alice.password, next)
      await signOut(page)
      await signInAlice(page, next)
      await changePassword(page, next, alice.password)
      await signOut(page)
    } finally {
      await restoreMailbox(administrator, alice.username, { password: alice.password })
      await administratorContext.close()
    }
  })

  test('US3-AS1 US3-AS5 alice receives a reset link, completes TOTP and restores her account', async ({
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
    const before = await readMailbox(administrator, alice.username)
    try {
      await signInAlice(page)
      const recipient = `${uniqueName('recovery')}@example.net`
      await page.goto('account/recovery-email')
      await page.getByLabel('Email', { exact: true }).fill(recipient)
      await page.getByLabel('Current password (confirm changes)').fill(alice.password)
      await page.getByRole('button', { name: 'Save changes' }).click()
      await expect(page.getByRole('main')).toContainText(
        `Changes to mailbox ${alice.username} have been saved`,
      )
      expect((await readMailbox(administrator, alice.username)).recoveryEmail).toBe(recipient)
      await signOut(page)
      await page.getByRole('link', { name: 'Forgot password?' }).click()
      await expect(page.getByRole('heading', { level: 1, name: 'Reset Password' })).toBeVisible()
      await page.getByLabel('Username', { exact: true }).fill(alice.username)
      await page.getByRole('button', { name: 'Request password change' }).click()
      await expect(page.locator('[data-reset-requested]')).toBeVisible()

      const link = await resetLink(page.request, recipient, baseURL!)
      await page.goto(link)
      await expect(page.locator('[data-reset-password]')).toBeVisible()
      await expect(page).toHaveURL(/\/ng\/reset-password$/)
      await expect(page.locator('[data-reset-account]')).toContainText(alice.username)
      const next = 'Smoke-reset-password-7q'
      await page.getByLabel('New Password', { exact: true }).fill(next)
      await page.getByLabel('Confirm new password').fill(next)
      await page.getByRole('button', { name: 'Reset Password', exact: true }).click()
      await expect(page.locator('[data-reset-factor]')).toBeVisible()
      await page.getByLabel('Six-digit code').fill(await freshTotp(alice.totpSecret))
      await page.getByRole('button', { name: 'Login', exact: true }).click()
      await expect(page.locator('[data-reset-done]')).toContainText(
        'Password was successfully changed',
      )
      await expect(page.getByRole('button', { name: /^Account menu of / })).toHaveCount(0)
      await signInAlice(page, next)
      await changePassword(page, next, alice.password)
      await page.goto('account/recovery-email')
      await page.getByLabel('Email', { exact: true }).fill(before.recoveryEmail ?? '')
      await page.getByLabel('Current password (confirm changes)').fill(alice.password)
      await page.getByRole('button', { name: 'Save changes' }).click()
      await expect(page.getByRole('main')).toContainText(
        `Changes to mailbox ${alice.username} have been saved`,
      )
      await signOut(page)
    } finally {
      await restoreMailbox(administrator, alice.username, {
        password: alice.password,
        recoveryEmail: before.recoveryEmail,
      })
      await administratorContext.close()
    }
  })
})
