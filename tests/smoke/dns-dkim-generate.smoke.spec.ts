// UI 010 US2 smoke test against the API dev stack (T046): `admin` generates a key for example.net
// from its entry and `reseller` from the domain page's DKIM section, each removed again.
import { expect, test } from '@playwright/test'

import { deleteDkimKey } from './fixtures/dns-api'
import { signIn } from './fixtures/domains-api'

test.describe('@dns DKIM generation', () => {
  test('admin generates a key for example.net with the default selector', async ({ page }) => {
    await signIn(page, 'admin')
    await deleteDkimKey(page, 'example.net')
    try {
      await page.goto('dns/dkim-keys/example.net')
      await page.getByRole('button', { name: 'Add ARC/DKIM key' }).click()
      await page.getByRole('dialog').getByRole('button', { name: 'Add', exact: true }).click()
      await expect(page.getByText('Key valid')).toBeVisible()
      await expect(page.locator('[data-dkim-record]')).toContainText('._domainkey.example.net')
    } finally {
      await deleteDkimKey(page, 'example.net')
    }
  })

  test('reseller generates a key for example.net from the domain page', async ({ page }) => {
    await signIn(page, 'reseller')
    await signIn(page, 'admin')
    await deleteDkimKey(page, 'example.net')
    await signIn(page, 'reseller')
    try {
      await page.goto('domains/example.net')
      const section = page.locator('#section-dkim')
      await section.getByRole('button', { name: 'Add ARC/DKIM key' }).click()
      await page.getByRole('dialog').getByRole('button', { name: 'Add', exact: true }).click()
      await expect(section).toContainText('Key valid')
    } finally {
      await signIn(page, 'admin')
      await deleteDkimKey(page, 'example.net')
    }
  })
})
