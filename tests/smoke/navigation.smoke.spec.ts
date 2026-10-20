// T096: navigation against the real API: scoped domain landing, Quarantine, denied API keys,
// and mailbox navigation with account actions in the user menu.
import { expect, test } from '@playwright/test'

import { admin, alice, reseller } from './fixtures/accounts'
import { expectHome, signIn, signOut } from './fixtures/flows'
import { freshTotp } from '../support/totp'

test('administrator enters System and Containers and can switch grouped tabs', async ({ page }) => {
  await signIn(page, admin.username, admin.password)
  await expectHome(page, admin.username)
  const navigation = page.getByRole('navigation', { name: 'Main navigation' })
  const sidebar = page.locator('[data-desktop-sidebar]')
  expect((await sidebar.boundingBox())?.y).toBe(0)
  expect((await page.getByRole('banner').boundingBox())?.x).toBe(290)
  await page.getByRole('button', { name: 'Collapse sidebar' }).click()
  await expect(sidebar).toHaveAttribute('data-collapsed', 'true')
  expect((await page.getByRole('banner').boundingBox())?.x).toBe(90)
  await page.getByRole('button', { name: 'Expand sidebar' }).click()

  for (const name of ['Home', 'Passkeys', 'User Settings', 'MTA-STS']) {
    await expect(navigation.getByRole('link', { name, exact: true })).toHaveCount(0)
  }
  const tabs = page.locator('[data-section-navigation]')
  await expect(tabs.getByRole('link')).toHaveText(['System & Containers', 'Logs', 'Audit log'])
  await tabs.getByRole('link', { name: 'Audit log', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Audit log' })).toBeVisible()
  await navigation.getByRole('link', { name: 'Domains', exact: true }).click()
  await expect(tabs.getByRole('link')).toHaveText(['Domains', 'Domain Templates'])
  await navigation.getByRole('link', { name: 'Access', exact: true }).click()
  await expect(tabs.getByRole('link')).toHaveText([
    'Administrators',
    'Domain administrators',
    'API keys',
    'Identity Provider',
    'OAuth2 Apps',
    'Rspamd UI',
  ])
  await tabs.getByRole('link', { name: 'Domain administrators', exact: true }).click()
  await expect(page).toHaveURL(/\/administrators\/domain-admins$/)
  await page.getByRole('button', { name: /^Account menu of / }).click()
  await page.getByRole('menuitem', { name: 'User Settings', exact: true }).click()
  await expect(page).toHaveURL(/\/account\/password$/)
  await expect(page.locator('[data-section-nav] a[aria-current="page"]')).toHaveText(
    'Change password',
  )
  await page.getByRole('button', { name: /^Account menu of / }).click()
  await page.getByRole('menuitem', { name: 'Passkeys', exact: true }).click()
  await expect(page.locator('[data-section-nav] a[aria-current="page"]')).toHaveText('Passkeys')

  await signOut(page)
})

test('reseller lands on its domains, opens Quarantine and has no access to API keys', async ({
  page,
}) => {
  await signIn(page, reseller.username, reseller.password, 'sign-in/domain-admin')
  await expectHome(page, reseller.username)
  await expect(page.locator('[data-entry]')).toHaveCount(2)
  await page.goto('quarantine')
  await expect(
    page.getByRole('main').getByRole('heading', { level: 1, name: 'Quarantine' }),
  ).toBeVisible()
  await page.goto('api-keys')
  await expect(page.getByRole('heading', { level: 1, name: 'No access' })).toBeVisible()
  await signOut(page)
})

test('alice sees only the entries of a mailbox user', async ({ page }) => {
  // An explicit protected destination keeps the existing webmail-forwarding preference intact.
  await signIn(page, alice.username, alice.password, 'account')
  await page.getByLabel('Six-digit code').fill(await freshTotp(alice.totpSecret))
  await page.getByRole('button', { name: 'Login', exact: true }).first().click()
  await expectHome(page, alice.username)
  const navigation = page.getByRole('navigation', { name: 'Main navigation' })
  const labels = (await navigation.getByRole('link').allInnerTexts()).map((label) => label.trim())
  for (const label of [
    'Domains',
    'Mailboxes',
    'Access',
    'System & Containers',
    'Options',
    'Home',
    'User Settings',
    'Passkeys',
    'MTA-STS',
  ]) {
    expect(labels).not.toContain(label)
  }
  expect(labels).toContain('Quarantine')
  await page.getByRole('button', { name: /^Account menu of / }).click()
  await expect(page.getByRole('menuitem', { name: 'User Settings', exact: true })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'Passkeys', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await signOut(page)
})
