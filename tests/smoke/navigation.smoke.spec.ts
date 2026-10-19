// T096: navigation against the real API: the domain administrator's home and placeholders, "no
// access" to API keys, and the mailbox user's entries.
import { expect, test } from '@playwright/test'

import { alice, reseller } from './fixtures/accounts'
import { expectHome, signIn, signOut } from './fixtures/flows'
import { freshTotp } from '../support/totp'

test('reseller sees its domains, a classic link for the quarantine and no access to API keys', async ({
  page,
}) => {
  await signIn(page, reseller.username, reseller.password, 'sign-in/domain-admin')
  await expectHome(page, reseller.username)
  await expect(page.getByRole('region', { name: 'Your scope' }).getByRole('listitem')).toHaveCount(
    2,
  )
  // Mailboxes and DNS became available with UI 003 and UI 010, so Quarantine is the placeholder.
  await page.goto('quarantine')
  await expect(page.getByRole('main').getByRole('link', { name: 'Quarantine' })).toHaveAttribute(
    'href',
    '/quarantine',
  )
  await page.goto('api-keys')
  await expect(page.getByRole('heading', { level: 1, name: 'No access' })).toBeVisible()
  await signOut(page)
})

test('alice sees only the entries of a mailbox user', async ({ page }) => {
  await signIn(page, alice.username, alice.password)
  await page.getByLabel('Six-digit code').fill(await freshTotp(alice.totpSecret))
  await page.getByRole('button', { name: 'Login', exact: true }).first().click()
  await expectHome(page, alice.username)
  const navigation = page.getByRole('navigation', { name: 'Main navigation' })
  const labels = (await navigation.getByRole('link').allInnerTexts()).map((label) => label.trim())
  for (const label of ['Domains', 'Mailboxes', 'API keys', 'Audit log', 'Administrators']) {
    expect(labels).not.toContain(label)
  }
  expect(labels).toEqual(
    expect.arrayContaining(['Home', 'User Settings', 'Passkeys', 'Quarantine']),
  )
  await signOut(page)
})
