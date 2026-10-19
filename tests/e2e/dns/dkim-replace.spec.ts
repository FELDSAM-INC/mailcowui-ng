// UI 010 US5, replacing a key with a new one (T079, FR-090): the selector hint, the confirmation
// with the current selector and length, the version tag, a key changed elsewhere, an incomplete key,
// the publication outcome, and no action for domain administrators.
import { expect, test } from '../fixtures/test'
import { FIRST_LOAD } from './helpers'

test.describe('DKIM replacement', () => {
  test('US5-AS8 replacing example.org keeps mail signed and sends the version tag', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('dns-admin')
    await page.goto('dns/dkim-keys/example.org')
    await page
      .getByRole('button', { name: 'Replace with a new key' })
      .click({ timeout: FIRST_LOAD })
    const dialog = page.getByRole('dialog')
    await expect(dialog.locator('[data-generate-hint]')).toContainText('other than dkim')
    await dialog.getByLabel('Selector').fill('dkim2026')
    await expectAccessible()
    await dialog.getByRole('button', { name: 'Replace' }).click()
    const ask = page.getByRole('alertdialog')
    await expect(ask).toContainText('The key dkim (2,048 bits)')
    await expect(ask).toContainText('mail stays signed')
    await ask.getByRole('button', { name: 'Replace' }).click()
    await expect(page.locator('[data-dkim-record]')).toContainText(
      'dkim2026._domainkey.example.org',
    )
    await expect(page.locator('[data-entry-status]')).toContainText('Update the DNS record')
    const sent = (await mockApi.requests()).filter((r) => r.operationId === 'generateDkimKey')
    expect(sent[0]!.headers['if-match']).toMatch(/^".+"$/)
    expect((sent[0]!.body as { overwrite: boolean }).overwrite).toBe(true)
  })

  test('a key changed elsewhere asks again; an incomplete key can be replaced', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('dns-admin')
    await page.goto('dns/dkim-keys/example.org')
    await page
      .getByRole('button', { name: 'Replace with a new key' })
      .click({ timeout: FIRST_LOAD })
    await page.getByRole('dialog').getByRole('button', { name: 'Replace' }).click()
    await mockApi.patch({ dns: { keys: { 'example.org': { selector: 'moved' } } } })
    await page.getByRole('alertdialog').getByRole('button', { name: 'Replace' }).click()
    await expect(page.getByRole('alertdialog')).toContainText('The key moved')
    await page.getByRole('alertdialog').getByRole('button', { name: 'Replace' }).click()
    await expect(page.locator('[data-entry-status]')).toContainText('has been saved')

    await page.goto('dns/dkim-keys/incomplete.example')
    await page.getByRole('button', { name: 'Replace with a new key' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Replace' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Replace' }).click()
    await expect(page.locator('[data-incomplete-notice]')).toHaveCount(0)
    await expect(page.locator('[data-dkim-record]')).toContainText('._domainkey.incomplete.example')
  })

  test('with publication on, the outcome is shown', async ({ page, mockApi }) => {
    await mockApi.use('dns-admin-fork')
    await page.goto('dns/dkim-keys/example.org')
    await page
      .getByRole('button', { name: 'Replace with a new key' })
      .click({ timeout: FIRST_LOAD })
    await page.getByRole('dialog').getByRole('button', { name: 'Replace' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Replace' }).click()
    await expect(page.locator('[data-entry-outcome]')).toContainText('Published to the DNS zone')
  })

  test('a domain administrator is not offered the replacement', async ({ page, mockApi }) => {
    await mockApi.use('dns-domain-admin')
    await page.goto('dns/dkim-keys/example.org')
    await expect(page.getByRole('heading', { level: 1, name: 'example.org' })).toBeVisible({
      timeout: FIRST_LOAD,
    })
    await expect(page.getByRole('button', { name: 'Replace with a new key' })).toHaveCount(0)
  })
})
