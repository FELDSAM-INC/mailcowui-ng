// T062: the password reset request (US3-AS3, US3-AS7, FR-034 to FR-037; legacy
// `reset-password.twig`, decision D18).
import { expect, test } from '../fixtures/test'

test('US3-AS3 the same confirmation for a known, an unknown and an ineligible address', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('account-password-reset')
  await page.goto('sign-in')
  await page.getByRole('link', { name: 'Forgot Password?' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Reset Password' })).toBeVisible()
  await expectAccessible()
  await expectNoHorizontalScroll()
  const confirmation =
    'If this address belongs to an account with a recovery e-mail address, a reset link valid for 15 minutes is on its way.'
  for (const address of ['carl@example.org', 'nobody@example.org', 'dora@example.org']) {
    await page.goto('reset-password/request')
    await page.getByLabel('Username').fill(address)
    await page.getByRole('button', { name: 'Request password change' }).click()
    await expect(page.locator('[data-reset-requested]')).toHaveText(confirmation)
  }
  await expectAccessible()
})

test('US3-AS7 FR-034 no link and an unavailable request screen when the server cannot send it', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('account-password-reset-unavailable')
  await page.goto('sign-in')
  await expect(page.getByRole('button', { name: 'Login', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Forgot Password?' })).toHaveCount(0)
  await page.goto('reset-password/request')
  await expect(page.locator('[data-reset-unavailable]')).toHaveText(
    'The password recovery is currently unavailable. Please contact your administrator.',
  )
})

test('FR-034 the link is on the role-neutral and mailbox-user screens only', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('account-password-reset')
  await page.goto('sign-in/mailbox-user')
  await expect(page.getByRole('link', { name: 'Forgot Password?' })).toBeVisible()
  await page.goto('sign-in/admin')
  await expect(page.getByRole('heading', { level: 1, name: 'Administrator Login' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Forgot Password?' })).toHaveCount(0)
})

test('FR-037 too many requests show the countdown; the address is checked', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('account-password-reset-throttled')
  await page.goto('reset-password/request')
  await page.getByLabel('Username').fill('carl')
  await page.getByRole('button', { name: 'Request password change' }).click()
  await expect(page.getByLabel('Username')).toHaveAttribute('aria-invalid', 'true')
  await page.getByLabel('Username').fill('carl@example.org')
  await page.getByRole('button', { name: 'Request password change' }).click()
  await expect(page.getByRole('main')).toContainText('Reset token limit has been exceeded.')
  await expect(page.getByRole('button', { name: 'Request password change' })).toBeDisabled()
})
