// FR-051: Passkeys remains reachable from the account menu after Home was removed.
import { expect, test } from '../fixtures/test'

test('FR-051 Passkeys is reachable from the user menu', async ({ page, mockApi }) => {
  await mockApi.use('admin-active')
  await page.goto('')
  await page.getByRole('button', { name: 'Account menu of admin' }).click()
  await page.getByRole('menuitem', { name: 'Passkeys' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Passkeys' })).toBeVisible()
})
