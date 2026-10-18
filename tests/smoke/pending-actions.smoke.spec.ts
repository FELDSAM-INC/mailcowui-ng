// T113: a forced password change against the real API: bob signs in, sees the action with the
// classic link, "Check again" reports it is still pending, and sign-out works.
import { expect, test } from '@playwright/test'

import { bob } from './fixtures/accounts'
import { signIn } from './fixtures/flows'

test('bob sees the pending password change and can sign out', async ({ page }) => {
  await signIn(page, bob.username, bob.password)
  await expect(page.getByRole('heading', { level: 1, name: 'Actions required' })).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Change your password in the classic interface' }),
  ).toHaveAttribute('href', '/')
  await page.getByRole('button', { name: 'Check again' }).click()
  await expect(
    page.getByRole('main').getByText('The password change is still pending.'),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page.getByRole('main').getByText('You have signed out.')).toBeVisible()
})
