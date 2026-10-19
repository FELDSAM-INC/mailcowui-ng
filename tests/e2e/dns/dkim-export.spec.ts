// UI 010 US6, exporting a private key (T090, FR-077, SC-007): asked first, shown once with copy and
// download, gone after closing; turned off on the server; closing before saving asks; nothing of
// the key stays in storage, the address, history or the live regions; no action for domain
// administrators.
import { expect, test } from '../fixtures/test'
import { FIRST_LOAD } from './helpers'

test.describe('DKIM private key export', () => {
  test('US6-AS1 US6-AS2 SC-007 the key is shown once with copy and download, then gone', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('dns-admin-fork')
    await page.goto('dns/dkim-keys/example.org')
    await page.getByRole('button', { name: 'Private key' }).click({ timeout: FIRST_LOAD })
    const ask = page.getByRole('alertdialog')
    await expect(ask).toContainText('lets its holder sign mail for example.org')
    await expect(ask).toContainText('recorded in the history')
    await ask.getByRole('button', { name: 'Show the private key' }).click()
    const dialog = page.getByRole('dialog')
    const field = dialog.locator('textarea')
    await expect(field).toHaveValue(/-----BEGIN PRIVATE KEY-----/)
    await expect(field).toHaveAttribute('readonly', '')
    await expectAccessible()
    const download = page.waitForEvent('download')
    await dialog.getByRole('button', { name: 'Download' }).click()
    const file = await download
    expect(file.suggestedFilename()).toBe('dkim.example.org.pem')
    const saved = await file
      .path()
      .then((path) => import('node:fs').then((fs) => fs.readFileSync(path, 'utf8')))
    expect(saved).toBe(await field.inputValue())
    await dialog.getByRole('button', { name: 'Close' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    const leftovers = await page.evaluate(() => ({
      local: JSON.stringify({ ...localStorage }),
      session: JSON.stringify({ ...sessionStorage }),
      history: JSON.stringify(history.state),
      address: location.href,
      live: [...document.querySelectorAll('[data-live]')].map((node) => node.textContent).join(' '),
      body: document.body.innerText,
    }))
    expect(JSON.stringify(leftovers)).not.toContain('PRIVATE KEY')
  })

  test('FR-077 closing before copying or downloading asks first, Escape too', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('dns-admin-fork')
    await page.goto('dns/dkim-keys/example.org')
    await page.getByRole('button', { name: 'Private key' }).click({ timeout: FIRST_LOAD })
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Show the private key' })
      .click()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('alertdialog')).toContainText('Have you saved the secret?')
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Yes, I have saved it' })
      .click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('US6-AS3 export off shows the note and no action', async ({ page, mockApi }) => {
    await mockApi.use('dns-admin')
    await page.goto('dns/dkim-keys/example.org')
    await expect(page.locator('[data-export-off]')).toContainText(
      'Private key export is turned off on this server.',
      { timeout: FIRST_LOAD },
    )
    await expect(page.getByRole('button', { name: 'Private key' })).toHaveCount(0)
  })

  test('US6-AS4 export turned off after loading says so and removes the action', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('dns-admin-fork')
    await page.goto('dns/dkim-keys/example.org')
    await page.getByRole('button', { name: 'Private key' }).click({ timeout: FIRST_LOAD })
    await mockApi.patch({ dns: { capabilities: { dkim: { privateKeyExportEnabled: false } } } })
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Show the private key' })
      .click()
    await expect(
      page.getByText('Private key export is turned off on this server. The operator'),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Private key' })).toHaveCount(0)
  })

  test('a domain administrator is never offered the export', async ({ page, mockApi }) => {
    await mockApi.use('dns-domain-admin', {
      dns: { capabilities: { dkim: { privateKeyExportEnabled: true } } },
    })
    await page.goto('dns/dkim-keys/example.org')
    await expect(page.getByRole('heading', { level: 1, name: 'example.org' })).toBeVisible({
      timeout: FIRST_LOAD,
    })
    await expect(page.getByRole('button', { name: 'Private key' })).toHaveCount(0)
    await expect(page.locator('[data-export-off]')).toHaveCount(0)
  })
})
