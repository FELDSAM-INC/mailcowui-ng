// UI 010 US5, copying a DKIM key (T077): targets from the searchable picker (never the source), a
// target with a key marked and overwritten only after agreement, one request per target with a
// result each, an incomplete source, and no access for domain administrators.
import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { FIRST_LOAD } from './helpers'

async function pick(page: Page, name: string) {
  const field = page.getByRole('combobox', { name: 'To' })
  await field.fill(name)
  await page.getByRole('option', { name: new RegExp(`^${name.replace(/\./g, '\\.')}`) }).click()
  // The list stays open for more choices (multiple mode); close it, as a user does.
  await page.keyboard.press('Escape')
}

test.describe('DKIM copy', () => {
  test('US5-AS4 FR-034 to FR-036 three targets, one with a key, overwritten after agreement', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
  }) => {
    await mockApi.use('dns-admin-fork')
    await page.goto('dns/dkim-keys/example.org/copy')
    await expect(
      page.getByRole('heading', { level: 1, name: 'Duplicate DKIM record' }),
    ).toBeVisible({
      timeout: FIRST_LOAD,
    })
    await expect(page.locator('[data-copy-source]')).toContainText('example.org')
    await page.getByRole('combobox', { name: 'To' }).fill('example')
    await expect(page.getByRole('option', { name: /^example\.net/ })).toBeVisible()
    await expect(page.getByRole('option', { name: /^example\.org/ })).toHaveCount(0)
    await page.keyboard.press('Escape')
    await pick(page, 'example.net')
    await pick(page, 'missing.example')
    await pick(page, 'shop.example')
    await expect(page.locator('[data-copy-has-key]')).toContainText(
      'shop.example has a key (selector shop).',
    )
    await expectAccessible()
    await expectNoHorizontalScroll()
    await page.getByRole('button', { name: 'Duplicate', exact: true }).click()
    const ask = page.getByRole('alertdialog')
    await expect(ask).toContainText('These names have a key: shop.example.')
    await ask.getByRole('button', { name: 'Duplicate' }).click()
    const run = page.locator('[data-run-dialog]')
    await expect(run.locator('[data-run-row]')).toHaveCount(3, { timeout: 30_000 })
    await expect(run).toContainText(
      'DKIM key for domain example.org has been copied to example.net',
    )
    await expect(run).toContainText('3 done')
    await expect(run.locator('[data-publication-outcome]').first()).toContainText('Published')
    const sent = (await mockApi.requests()).filter((r) => r.operationId === 'copyDkimKey')
    expect(sent).toHaveLength(3)
    const shop = sent.find((r) => (r.body as { target: string }).target === 'shop.example')!
    expect(shop.headers['if-match']).toMatch(/^".+"$/)
    expect((shop.body as { overwrite: boolean }).overwrite).toBe(true)
  })

  test('FR-035 declining the overwrite leaves the target out', async ({ page, mockApi }) => {
    await mockApi.use('dns-admin')
    await page.goto('dns/dkim-keys/example.org/copy')
    await pick(page, 'example.net')
    await pick(page, 'shop.example')
    await page.getByRole('button', { name: 'Duplicate', exact: true }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Skip these names' }).click()
    const run = page.locator('[data-run-dialog]')
    await expect(run.locator('[data-run-row]')).toHaveCount(1, { timeout: 30_000 })
    await expect(run).toContainText('example.net')
  })

  test('Edge: an incomplete source cannot be copied', async ({ page, mockApi }) => {
    await mockApi.use('dns-admin')
    await page.goto('dns/dkim-keys/incomplete.example/copy')
    await expect(page.locator('[data-copy-incomplete]')).toContainText(
      'This key is incomplete and cannot be copied.',
      { timeout: FIRST_LOAD },
    )
    await expect(page.getByRole('combobox', { name: 'To' })).toHaveCount(0)
  })

  test('Edge: a target removed before sending is reported, and the run continues', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('dns-admin')
    await page.goto('dns/dkim-keys/example.org/copy')
    await pick(page, 'example.net')
    await pick(page, 'shop.example')
    await mockApi.removeDomain('example.net')
    await page.getByRole('button', { name: 'Duplicate', exact: true }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Duplicate' }).click()
    const run = page.locator('[data-run-dialog]')
    await expect(run.locator('[data-run-row]')).toHaveCount(2, { timeout: 30_000 })
    await expect(run.locator('[data-run-row]', { hasText: 'example.net' })).toContainText(
      'This item does not exist.',
    )
    await expect(run.locator('[data-run-row]', { hasText: 'shop.example' })).toContainText('Done')
  })

  test('a domain administrator has no access to the copy', async ({ page, mockApi }) => {
    await mockApi.use('dns-domain-admin')
    await page.goto('dns/dkim-keys/example.org/copy')
    await expect(page.getByRole('heading', { level: 1, name: 'No access' })).toBeVisible({
      timeout: FIRST_LOAD,
    })
  })
})
