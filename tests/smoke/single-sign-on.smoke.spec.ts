// UI 012 US2 smoke test (T050, T101, research R25): single sign-on through a real Keycloak. On the
// API dev stack (`SMOKE_IDP=1`) the test stores the stack's Keycloak (realm import of
// mailcow-rest-v2) as the identity provider and signs in as its user anna@example.org, whose mailbox
// is created from the mapped template and removed afterwards. On a mailcow host it uses the stored
// configuration with SMOKE_SSO_USERNAME and SMOKE_SSO_PASSWORD. The user signs in on the real
// Keycloak page, lands on home with a clean address and no code or state in this tab's storage,
// and signs out with the provider note.
import { expect, test } from '@playwright/test'

import { signIn as signInAs } from './fixtures/domains-api'
import {
  configureDevKeycloak,
  DEV_KEYCLOAK,
  idpEnabled,
  removeIdentityProvider,
  removeMailbox,
} from './fixtures/identity-provider'

const devStack = idpEnabled()
const username = process.env.SMOKE_SSO_USERNAME ?? (devStack ? DEV_KEYCLOAK.username : '')
const password = process.env.SMOKE_SSO_PASSWORD ?? (devStack ? DEV_KEYCLOAK.password : '')

test.describe('@sso single sign-on through Keycloak', () => {
  test.skip(
    !username || !password,
    'needs SMOKE_IDP=1 (the API dev stack with its Keycloak) or SMOKE_SSO_USERNAME and SMOKE_SSO_PASSWORD (a mailcow host with single sign-on)',
  )

  test.beforeAll(async ({ browser }) => {
    if (!devStack) return
    const page = await browser.newPage()
    await signInAs(page, 'admin')
    await removeMailbox(page, username)
    await configureDevKeycloak(page)
    await page.close()
  })

  test.afterAll(async ({ browser }) => {
    if (!devStack) return
    const page = await browser.newPage()
    await signInAs(page, 'admin')
    await removeMailbox(page, username)
    await removeIdentityProvider(page)
    await page.close()
  })

  test('a Keycloak mailbox signs in with single sign-on and signs out with the provider note', async ({
    page,
  }) => {
    await page.goto('sign-in/mailbox-user')
    await page.getByRole('button', { name: 'Single Sign-On' }).click()
    await page.locator('#username').fill(username)
    await page.locator('#password').fill(password)
    await page.locator('#kc-login').click()
    await expect(page).toHaveURL(/\/ng\/$/, { timeout: 30_000 })
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    expect(page.url()).not.toMatch(/[?&](code|state)=/)
    const stored = await page.evaluate(() => JSON.stringify({ ...sessionStorage, ...localStorage }))
    expect(stored).not.toMatch(/code|state/i)
    await page.getByRole('button', { name: /^Account menu of / }).click()
    await page.getByRole('menuitem', { name: 'Sign out' }).click()
    await expect(page.locator('[data-notice]')).toContainText(
      "still signed in at your organisation's sign-in service",
    )
  })
})
