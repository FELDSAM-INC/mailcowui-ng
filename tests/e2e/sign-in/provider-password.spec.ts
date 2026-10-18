// UI 012 T061: password sign-in of LDAP and Keycloak mailboxes through UI 001's form (US3,
// FR-050, FR-051, FR-042).
import { passwordForm, submitPassword } from '../fixtures/flows'
import { expect as baseExpect, test } from '../fixtures/test'

// Every round trip loads the app twice (before and after the provider); on a loaded machine the
// second boot can take longer than the default 5 s, most of all on WebKit.
const expect = baseExpect.configure({ timeout: 15_000 })

const UNREACHABLE =
  "Your organisation's sign-in service cannot be reached. Please try again in a few minutes."

test.describe('password sign-in through the identity provider', () => {
  test('US3-AS1 FR-050 an LDAP mailbox signs in through the role-neutral and the mailbox-user screen', async ({
    page,
    mockApi,
  }) => {
    for (const path of ['sign-in', 'sign-in/mailbox-user']) {
      await mockApi.use('ldap-password')
      await page.goto(path)
      await submitPassword(page, 'carl@example.org')
      await expect(page).toHaveURL(/\/ng\/$/)
    }
  })

  test('US3-AS1 an LDAP mailbox with an authenticator app reaches the second-factor step', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('ldap-password-totp')
    await page.goto('sign-in')
    await submitPassword(page, 'carl@example.org')
    await expect(page).toHaveURL(/\/ng\/sign-in\/second-factor/)
  })

  test('US3-AS2 FR-051 an unreachable provider is a temporary failure: username kept, password cleared, no countdown', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
  }) => {
    await mockApi.use('ldap-provider-down')
    await page.goto('sign-in')
    const started = Date.now()
    await submitPassword(page, 'carl@example.org')
    const message = page.locator('[data-provider-unavailable]')
    await expect(message).toContainText(UNREACHABLE)
    await expect(message).toBeFocused()
    expect(Date.now() - started).toBeLessThan(5000)
    const form = passwordForm(page)
    await expect(form.username).toHaveValue('carl@example.org')
    await expect(form.password).toHaveValue('')
    await expect(page.getByText(/wrong|incorrect|Login failed/i)).toHaveCount(0)
    await expect(page.getByText(/You can try again in/)).toHaveCount(0)
    await expect(form.submit).toBeEnabled()
    await expectAccessible()
    await expectNoHorizontalScroll()
    // An immediate retry is possible.
    await form.password.fill('anything')
    await form.submit.click()
    await expect(message).toBeVisible()
  })

  test('US3-AS3 FR-042 no identity-provider hint with a provider configured', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('ldap-password')
    await page.goto('sign-in/mailbox-user')
    await expect(passwordForm(page).username).toBeVisible()
    await expect(page.getByRole('note')).toHaveCount(0)
  })

  test("US3-AS4 a Keycloak mailbox whose template forces second-factor setup gets UI 001's pending actions", async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('keycloak-password-forced-2fa')
    await page.goto('sign-in')
    await submitPassword(page, 'dave@example.org')
    await expect(page).toHaveURL(/\/ng\/pending-actions/)
  })

  test('throttling and the generic failure behave as for every account', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('ldap-throttled')
    await page.goto('sign-in')
    await submitPassword(page, 'carl@example.org')
    await expect(page.locator('form').getByText(/You can try again in/)).toBeVisible()
    await mockApi.use('ldap-password')
    await page.goto('sign-in')
    await submitPassword(page, 'carl@example.org', 'wrong')
    await expect(page.getByRole('alert')).toContainText('Login failed')
  })
})
