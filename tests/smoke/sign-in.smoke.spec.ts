// T075: sign-in smoke tests against a real mailcow-rest-v2 dev stack (research R25, quickstart
// Part C): each role signs in and out, alice completes her TOTP second factor, an unknown user
// gets the generic failure, and the image sends the strict CSP.
import { expect, test } from '@playwright/test'

import { expectNoHorizontalScroll } from '../e2e/fixtures/layout'
import { admin, alice, reseller, unknownUsername } from './fixtures/accounts'
import { expectHome, signIn, signOut } from './fixtures/flows'
import { freshTotp } from './fixtures/totp'

const CSP =
  "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; object-src 'none'"

test('@read-only admin signs in with a password and signs out', async ({ page }) => {
  await signIn(page, admin.username, admin.password)
  await expectHome(page, admin.username)
  await signOut(page)
})

test('@read-only reseller signs in on the domain-administrator screen and signs out', async ({
  page,
}) => {
  await signIn(page, reseller.username, reseller.password, 'sign-in/domain-admin')
  await expectHome(page, reseller.username)
  await signOut(page)
})

test('alice completes her TOTP second factor and signs out', async ({ page }) => {
  await signIn(page, alice.username, alice.password)
  await expect(
    page.getByRole('heading', { level: 1, name: 'Two-factor authentication' }),
  ).toBeVisible()
  await page.getByLabel('Six-digit code').fill(await freshTotp(alice.totpSecret))
  await page.getByRole('button', { name: 'Verify', exact: true }).first().click()
  await expectHome(page, alice.username)
  await signOut(page)
})

test('an unknown username gets the generic failure', async ({ page }) => {
  await signIn(page, unknownUsername(), 'not-the-password')
  await expect(page.getByRole('alert')).toContainText(
    'Sign-in failed. Check your details and try again.',
  )
})

test('/ng/ sends the strict Content-Security-Policy', async ({ request, baseURL }) => {
  const response = await request.get(baseURL ?? '/ng/')
  expect(response.status()).toBe(200)
  expect(response.headers()['content-security-policy']).toBe(CSP)
})

test.describe('at 360 px', () => {
  test.use({ viewport: { width: 360, height: 780 } })

  test('@read-only admin signs in without horizontal scrolling', async ({ page }) => {
    await page.goto('sign-in')
    await expectNoHorizontalScroll(page)
    await signIn(page, admin.username, admin.password)
    await expectHome(page, admin.username)
    await expectNoHorizontalScroll(page)
    await signOut(page)
  })
})
