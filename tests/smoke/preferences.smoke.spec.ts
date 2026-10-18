// T119: preferences against the real API: admin switches to Czech and the dark theme, signs out,
// and a new browser context signs in in Czech and dark. The original preferences are restored.
import { expect, test } from '@playwright/test'

import { admin } from './fixtures/accounts'
import { signIn } from './fixtures/flows'

test('the language and the theme follow admin to another browser', async ({
  page,
  browser,
  baseURL,
}) => {
  await signIn(page, admin.username, admin.password)
  await page.getByRole('button', { name: `Account menu of ${admin.username}` }).click()
  await page.getByRole('menuitemradio', { name: 'Čeština' }).click()
  await page.getByRole('button', { name: `Nabídka účtu ${admin.username}` }).click()
  await page.getByRole('menuitemradio', { name: 'Tmavý' }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.getByRole('button', { name: `Nabídka účtu ${admin.username}` }).click()
  await page.getByRole('menuitem', { name: 'Odhlásit se' }).click()

  const context = await browser.newContext({ baseURL, locale: 'en-GB' })
  const other = await context.newPage()
  await signIn(other, admin.username, admin.password)
  await expect(
    other.getByRole('heading', { level: 1, name: `Dobrý den, ${admin.username}` }),
  ).toBeVisible()
  await expect(other.locator('html')).toHaveClass(/dark/)

  // Restore English and the device setting for the other smoke tests.
  await other.getByRole('button', { name: `Nabídka účtu ${admin.username}` }).click()
  await other.getByRole('menuitemradio', { name: 'English' }).click()
  await other.getByRole('button', { name: `Account menu of ${admin.username}` }).click()
  await other.getByRole('menuitemradio', { name: 'Device setting' }).click()
  await context.close()
})
