// UI 009 US5 smoke test (T084, research R25): as admin, a recipient BCC map for @example.org to an
// external archive address is created and deleted; as reseller, the BCC maps are listed with change
// controls only when the identity has the BCC maps permission.
import { expect, test } from '@playwright/test'

import { signIn, uniqueName } from './fixtures/domains-api'
import { deleteEntries, findEntries } from './fixtures/routing-api'

test.describe('@routing bcc maps', () => {
  test('admin creates and deletes a recipient map for a domain', async ({ page }) => {
    const archive = `${uniqueName('archive')}@archive.smoke.example`
    await signIn(page, 'admin')
    try {
      await page.goto('routing/bcc-maps/new')
      await page.getByRole('combobox', { name: 'Local destination' }).fill('@example.org')
      await page.getByRole('option', { name: '@example.org', exact: true }).click()
      await page.getByLabel('BCC type').selectOption('rcpt')
      await page.getByLabel('BCC destination').fill(archive)
      await page.getByRole('button', { name: 'Add', exact: true }).click()
      await expect(page.locator('[data-live="polite"]')).toContainText('BCC map entry saved')
      const [created] = await findEntries(page, 'bcc-maps', 'bccDestination', archive)
      expect(created).toMatchObject({ localDestination: '@example.org', type: 'recipient' })
      await page.goto(`routing/bcc-maps?q=${encodeURIComponent(archive)}`)
      await page.getByRole('button', { name: 'Remove: @example.org' }).click()
      await page.getByRole('alertdialog').getByRole('button', { name: 'Delete now' }).click()
      await expect(page.locator(`[data-entry="${created!.id}"]`)).toHaveCount(0)
    } finally {
      await deleteEntries(page, 'bcc-maps', 'bccDestination', archive)
    }
  })

  test('reseller sees the BCC maps with change controls only with the permission', async ({
    page,
  }) => {
    await signIn(page, 'reseller')
    const identity = await page.request.get('/api/v2/me')
    const { bccMaps } = ((await identity.json()) as { data: { permissions: { bccMaps: boolean } } })
      .data.permissions
    await page.goto('routing/bcc-maps')
    await expect(page.getByRole('heading', { level: 1, name: 'BCC maps' })).toBeVisible()
    await expect(page.locator('[data-list-state]')).not.toHaveAttribute(
      'data-list-state',
      'loading',
    )
    await expect(page.locator('[data-add]')).toHaveCount(bccMaps ? 1 : 0)
  })
})
