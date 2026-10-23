import { openBulkActions } from '../fixtures/flows'
// UI 010 US5, deleting DKIM keys (T078): the impact of one deletion, an unused key, the bulk
// deletion with the number typed and one request with every version, outdated and failed keys kept
// selected, the publication outcomes, a dropped connection, skipped entries, and a key changed or
// removed elsewhere.
import type { Page } from '@playwright/test'

import { politeRegion } from '../fixtures/flows'
import { expect, test } from '../fixtures/test'
import { FIRST_LOAD, entryNames, listReady } from './helpers'

async function selectNames(page: Page, names: string[]) {
  await page.getByRole('button', { name: 'Select', exact: true }).click()
  for (const name of names) await page.getByRole('checkbox', { name: `Select ${name}` }).check()
}

const bar = (page: Page) => page.getByRole('region', { name: 'Bulk actions' })

test.describe('DKIM deletion', () => {
  test('US5-AS5 deleting example.org shows the impact, then "Key missing"', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('dns-admin')
    await page.goto('dns/dkim-keys/example.org')
    await page.getByRole('button', { name: 'Remove' }).click({ timeout: FIRST_LOAD })
    const ask = page.getByRole('alertdialog')
    await expect(ask.getByRole('heading', { name: 'Confirm deletion' })).toBeVisible()
    await expect(ask).toContainText('example.org')
    await expect(ask).toContainText('2,048')
    await expect(ask).toContainText('no longer signed')
    await expect(ask).toContainText('The private key is deleted permanently.')
    await expect(ask).toContainText('The DNS record stays in the DNS zone')
    await expectAccessible()
    await ask.getByRole('button', { name: 'Delete now' }).click()
    await expect(page.getByText('Key missing')).toBeVisible()
    await expect(politeRegion(page)).toHaveText('DKIM key example.org has been removed')
  })

  test('US5-AS5 with publication on, the record is removed and recorded in the history', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('dns-admin-fork')
    await page.goto('dns/dkim-keys/example.org')
    await page.getByRole('button', { name: 'Remove' }).click({ timeout: FIRST_LOAD })
    await expect(page.getByRole('alertdialog')).toContainText(
      'removed from the DNS zone; the outcome is recorded in the history',
    )
  })

  test('US5-AS6 deleting the unused old.example returns to the list without it', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('dns-admin')
    await page.goto('dns/dkim-keys/old.example')
    await page.getByRole('button', { name: 'Remove' }).click({ timeout: FIRST_LOAD })
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete now' }).click()
    await expect(page).toHaveURL(/\/dns\/dkim-keys$/)
    await listReady(page)
    expect(await entryNames(page)).not.toContain('old.example')
  })

  test('US5-AS7 FR-092 five keys in one request after "5" is typed, with per-key results', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('dns-admin')
    await page.goto('dns/dkim-keys')
    await listReady(page)
    await selectNames(page, [
      'example.org',
      'example.com',
      'shop.example',
      'old.example',
      'Legacy.Example',
      'example.net',
    ])
    await (await openBulkActions(page)).getByRole('button', { name: 'Remove' }).click()
    const ask = page.getByRole('alertdialog')
    await expect(ask.locator('[data-delete-target]')).toHaveCount(5)
    await expect(ask.locator('[data-stops-signing]')).toHaveCount(3)
    await expect(ask.locator('[data-delete-skipped]')).toContainText('example.net')
    const remove = ask.getByRole('button', { name: 'Delete now' })
    await expect(remove).toBeDisabled()
    await ask.getByRole('textbox').fill('4')
    await expect(remove).toBeDisabled()
    await ask.getByRole('textbox').fill('5')
    await expectAccessible()
    await remove.click()
    const results = page.locator('[data-bulk-results]')
    await expect(results).toContainText('5 done')
    await expect(results).toContainText('DKIM key example.org has been removed')
    const sent = (await mockApi.requests()).filter(
      (r) => r.operationId === 'applyDkimKeyBulkAction',
    )
    expect(sent).toHaveLength(1)
    const targets = (sent[0]!.body as { targets: { id: string; version?: string }[] }).targets
    expect(targets.map((target) => target.id).sort()).toEqual(
      ['Legacy.Example', 'example.com', 'example.org', 'old.example', 'shop.example'].sort(),
    )
    expect(targets.every((target) => /^".+"$/.test(target.version ?? ''))).toBe(true)
  })

  test('FR-092 an outdated and a failed key stay selected, with their reasons', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('dns-admin', { dns: { failingBulkTargets: ['shop.example'] } })
    await page.goto('dns/dkim-keys')
    await listReady(page)
    await selectNames(page, ['example.org', 'shop.example', 'old.example'])
    await mockApi.patch({ dns: { keys: { 'old.example': { selector: 'changed' } } } })
    await (await openBulkActions(page)).getByRole('button', { name: 'Remove' }).click()
    await page.getByRole('alertdialog').getByRole('textbox').fill('3')
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete now' }).click()
    const results = page.locator('[data-bulk-results]')
    await expect(results).toContainText('1 done')
    await expect(results).toContainText('1 changed in the meantime')
    await expect(results).toContainText('1 failed')
    await expect(bar(page)).toContainText('2 selected')
  })

  test('FR-092 publication on shows the removal outcome of each key', async ({ page, mockApi }) => {
    await mockApi.use('dns-admin-fork')
    await page.goto('dns/dkim-keys')
    await listReady(page)
    await selectNames(page, ['example.org'])
    await (await openBulkActions(page)).getByRole('button', { name: 'Remove' }).click()
    await page.getByRole('alertdialog').getByRole('textbox').fill('1')
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete now' }).click()
    await expect(page.locator('[data-bulk-results] [data-publication-outcome]')).toBeVisible()
  })

  test('Edge: a dropped connection reports "outcome unknown" for every key', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('dns-admin')
    await page.goto('dns/dkim-keys')
    await listReady(page)
    await selectNames(page, ['example.org', 'shop.example'])
    await page.route('**/api/v2/dkim-keys/bulk-actions', (route) => route.abort('connectionreset'))
    await (await openBulkActions(page)).getByRole('button', { name: 'Remove' }).click()
    await page.getByRole('alertdialog').getByRole('textbox').fill('2')
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete now' }).click()
    await expect(page.locator('[data-bulk-results]')).toContainText('2 with unknown outcome')
  })

  test('FR-039 a key changed elsewhere asks again with fresh data; a vanished key says so', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('dns-admin')
    await page.goto('dns/dkim-keys/shop.example')
    await page.getByRole('button', { name: 'Remove' }).click({ timeout: FIRST_LOAD })
    await mockApi.patch({ dns: { keys: { 'shop.example': { selector: 'renewed' } } } })
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete now' }).click()
    const again = page.getByRole('alertdialog')
    await expect(again).toContainText('renewed')
    await again.getByRole('button', { name: 'Cancel' }).click()
    await page.getByRole('button', { name: 'Remove' }).click()
    await mockApi.patch({ dns: { keys: { 'shop.example': null } } })
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete now' }).click()
    await expect(page.locator('[data-entry-status]')).toContainText('This entry no longer exists.')
  })
})
