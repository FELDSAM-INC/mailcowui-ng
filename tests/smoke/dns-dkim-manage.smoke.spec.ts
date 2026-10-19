// UI 010 US5 smoke test against the API dev stack (T081), as `admin`, idempotent across reruns:
// import a generated key for import.example (unused), copy example.org to example.net, bulk-delete
// both, and replace example.org's key with a new selector.
import { generateKeyPairSync } from 'node:crypto'

import { expect, test } from '@playwright/test'

import { deleteDkimKey, readDkimKey } from './fixtures/dns-api'
import { signIn } from './fixtures/domains-api'

test.describe('@dns DKIM management', () => {
  test.describe.configure({ mode: 'serial' })

  test('import, copy, bulk-delete and replace', async ({ page }) => {
    test.setTimeout(120_000)
    await signIn(page, 'admin')
    await deleteDkimKey(page, 'import.example')
    await deleteDkimKey(page, 'example.net')

    // 1. Import a 2,048-bit key for a name that is no domain: listed as unused.
    const { privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    })
    await page.goto('dns/dkim-import')
    await page.getByLabel('Domain').fill('import.example')
    await page.locator('#dkim-import-key').fill(privateKey)
    await page.getByRole('button', { name: 'Import', exact: true }).click()
    await expect(page.getByText('Key unused')).toBeVisible()

    // 2. Copy example.org to example.net.
    await page.goto('dns/dkim-keys/example.org/copy')
    await page.getByRole('combobox', { name: 'To' }).fill('example.net')
    await page.getByRole('option', { name: /^example\.net/ }).click()
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Duplicate', exact: true }).click()
    await expect(page.locator('[data-run-dialog]')).toContainText('1 done', { timeout: 30_000 })
    await page.locator('[data-run-dialog]').getByRole('button', { name: 'Close' }).click()

    // 3. Bulk-delete example.net and import.example with the count typed.
    await page.goto('dns/dkim-keys?size=100')
    await page.getByRole('button', { name: 'Select', exact: true }).click()
    await page.getByRole('checkbox', { name: 'Select example.net' }).check()
    await page.getByRole('checkbox', { name: 'Select import.example' }).check()
    await page
      .getByRole('region', { name: 'Bulk actions' })
      .getByRole('button', { name: 'Remove' })
      .click()
    await page.getByRole('alertdialog').getByRole('textbox').fill('2')
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete now' }).click()
    await expect(page.locator('[data-bulk-results]')).toContainText('2 done')
    expect(await readDkimKey(page, 'import.example')).toBeNull()

    // 4. Replace example.org's key with a new selector.
    const selector = `smoke${Date.now()}`
    await page.goto('dns/dkim-keys/example.org')
    await page.getByRole('button', { name: 'Replace with a new key' }).click()
    await page.getByRole('dialog').getByLabel('Selector').fill(selector)
    await page.getByRole('dialog').getByRole('button', { name: 'Replace' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Replace' }).click()
    await expect(page.locator('[data-dkim-record]')).toContainText(
      `${selector}._domainkey.example.org`,
    )
    expect((await readDkimKey(page, 'example.org'))?.key?.selector).toBe(selector)
  })
})
