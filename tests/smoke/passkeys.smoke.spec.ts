// T105: passkeys against the real API with a virtual authenticator and real verification: admin
// registers a passkey, renames it, signs out, signs in with it (US2), and removes it.
import { expect, test } from '@playwright/test'

import { admin } from './fixtures/accounts'
import { expectHome, signIn, signOut } from './fixtures/flows'

test('admin registers, renames, signs in with and removes a passkey', async ({ page, context }) => {
  const client = await context.newCDPSession(page)
  await client.send('WebAuthn.enable')
  await client.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  })
  // The virtual authenticator would answer the autofill request by itself.
  await context.addInitScript(() => {
    if (typeof window.PublicKeyCredential !== 'function') return
    Object.defineProperty(window.PublicKeyCredential, 'isConditionalMediationAvailable', {
      configurable: true,
      value: () => Promise.resolve(false),
    })
  })
  const name = `Smoke ${Date.now()}`
  await signIn(page, admin.username, admin.password)
  await expectHome(page, admin.username)
  await page.goto('passkeys')
  await page.getByLabel('Name (optional)').fill(name)
  await page.getByRole('button', { name: 'Add a passkey' }).click()
  const card = page.getByRole('main').getByRole('listitem').filter({ hasText: name })
  await expect(card).toBeVisible()

  await card.getByRole('button', { name: 'Rename' }).click()
  await page.getByRole('dialog').getByLabel('Name').fill(`${name} renamed`)
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click()
  const renamed = page
    .getByRole('main')
    .getByRole('listitem')
    .filter({ hasText: `${name} renamed` })
  await expect(renamed).toBeVisible()

  await signOut(page)
  await page.getByRole('button', { name: 'Sign in with a passkey' }).click()
  await expectHome(page, admin.username)

  await page.goto('passkeys')
  await renamed.getByRole('button', { name: 'Remove' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Remove' }).click()
  await expect(renamed).toHaveCount(0)
  await signOut(page)
})
