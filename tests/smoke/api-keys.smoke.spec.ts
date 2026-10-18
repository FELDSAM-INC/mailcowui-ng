// T128: API keys against a real mailcow-rest-v2 dev stack (research R25): as admin, search the
// owner candidates, create a read-only key owned by reseller, copy the secret, see the prefix on
// the detail page, and revoke the key.
import { expect, test } from '@playwright/test'

import { admin } from './fixtures/accounts'
import { expectHome, signIn, signOut } from './fixtures/flows'

test('admin creates, inspects and revokes an API key owned by reseller', async ({
  page,
  context,
  browserName,
}) => {
  if (browserName === 'chromium') {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  }
  await signIn(page, admin.username, admin.password)
  await expectHome(page, admin.username)
  await page.goto('api-keys/new')
  const name = `Smoke key ${Date.now()}`
  await page.getByRole('textbox', { name: 'Name' }).fill(name)
  const owner = page.getByRole('combobox', { name: 'Owner' })
  await owner.fill('res')
  await page.getByRole('option', { name: /^reseller\b/ }).click()
  await expect(page.getByRole('radio', { name: 'Read-Only Access' })).toBeChecked()
  await page.getByRole('button', { name: 'Create API key' }).click()

  const dialog = page.getByRole('dialog', { name: 'Your new API key' })
  const secret = await dialog.getByRole('textbox', { name: 'Secret' }).inputValue()
  expect(secret).toMatch(/^mcv2_[A-Za-z0-9]{40}$/)
  await dialog.getByRole('button', { name: 'Copy' }).click()
  await dialog.getByRole('button', { name: 'Close' }).click()
  const confirm = page.getByRole('alertdialog', { name: 'Have you saved the secret?' })
  if (await confirm.isVisible())
    await confirm.getByRole('button', { name: 'Yes, I have saved it' }).click()

  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
  const main = page.getByRole('main')
  await expect(main).toContainText(secret.slice(0, 10))
  await expect(main).toContainText('reseller')
  await expect(page.locator('body')).not.toContainText(secret)

  await page.getByRole('button', { name: 'Revoke key' }).click()
  await page
    .getByRole('alertdialog', { name: `Revoke ${name}?` })
    .getByRole('button', { name: 'Revoke key' })
    .click()
  await expect(main.getByRole('term').filter({ hasText: /^Revoked$/ })).toHaveCount(1)
  await signOut(page)
})
