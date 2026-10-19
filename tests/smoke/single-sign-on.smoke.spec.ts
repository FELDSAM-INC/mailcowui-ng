// UI 012 US2 smoke test (T050, research R25): single sign-on through the API dev stack's Keycloak.
// The realm is set up by hand (API quickstart Part B), so the test runs only with
// SMOKE_SSO_USERNAME and SMOKE_SSO_PASSWORD (plan, Complexity Tracking). The user signs in on the
// real Keycloak page, lands on home with a clean address and no code or state in this tab's
// storage, and signs out with the provider note.
import { expect, test } from '@playwright/test'

const username = process.env.SMOKE_SSO_USERNAME ?? ''
const password = process.env.SMOKE_SSO_PASSWORD ?? ''

test.describe('@sso single sign-on through Keycloak', () => {
  test.skip(
    !username || !password,
    'needs SMOKE_SSO_USERNAME and SMOKE_SSO_PASSWORD (a Keycloak realm set up as API quickstart Part B describes)',
  )

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
