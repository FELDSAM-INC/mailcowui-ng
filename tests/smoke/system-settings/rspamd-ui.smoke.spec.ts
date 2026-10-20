// Read and client-validation only: never set the shared stack's password or restart Rspamd.
import { expect, test } from '@playwright/test'
import type { SettingsCapabilities } from '@/api'
import { requireLocalStack } from '../fixtures/account-api'
import { admin } from '../fixtures/accounts'
import { expectHome, signIn, signOut } from '../fixtures/flows'

test('@013 @local-stack Rspamd UI uses reported capabilities and validates without a write', async ({
  page,
  baseURL,
}) => {
  requireLocalStack(baseURL)
  await signIn(page, admin.username, admin.password)
  await expectHome(page, admin.username)
  const response = await page.request.get('/api/v2/capabilities/settings')
  expect(response.status()).toBe(200)
  const caps = ((await response.json()) as { data: SettingsCapabilities }).data
  let writes = 0
  page.on('request', (request) => {
    if (request.method() === 'PUT' && request.url().includes('/settings/rspamd-ui-password'))
      writes++
  })
  // A test regression may never send a password to the shared service.
  await page.route('**/api/v2/settings/rspamd-ui-password', (route) => route.abort())
  await page.goto('system/rspamd-web-interface')
  await expect(page.getByRole('heading', { level: 1, name: 'Rspamd UI' })).toBeVisible()
  await expect(page.locator('[data-rspamd-link]')).toHaveAttribute(
    'href',
    caps.rspamdWebInterfaceUrl,
  )
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('')
  await page.getByLabel('Password', { exact: true }).fill('short')
  await page.getByLabel('Confirmation password (repeat)').fill('short')
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(
    page.getByText('Rspamd UI password should be at least 6 chars long', { exact: false }),
  ).toBeVisible()
  expect(writes).toBe(0)
  await page.getByLabel('Password', { exact: true }).fill('')
  await page.getByLabel('Confirmation password (repeat)').fill('')
  await signOut(page)
})
