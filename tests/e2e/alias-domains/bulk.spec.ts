// UI 004 US6, mass actions on domain aliases (T082): activate, deactivate and delete, offered also
// without `aliasDomains` (US6-AS7); deactivate with one confirmation; delete listing every name with
// the consequences and the typed count; temporary failures reported and kept selected.
import { BULK_ALIAS_DOMAINS_004, FAILING_ALIAS_DOMAINS_004 } from '../../mocks/scenarios/bulk-004'
import { expect, test } from '../fixtures/test'
import type { Page } from '@playwright/test'
import { listReady } from '../aliases/helpers'
import { entry } from './helpers'

const bar = (page: Page) => page.getByRole('region', { name: 'Bulk actions' })

async function startSelecting(page: Page) {
  await page.goto('alias-domains')
  await listReady(page)
  await page.getByRole('button', { name: 'Select', exact: true }).click()
}

test.describe('domain aliases: mass actions', () => {
  test('US6-AS7 activate, deactivate and delete are offered without "aliasDomains"', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('bulk-alias-domains-da')
    await startSelecting(page)
    await expect(bar(page).getByRole('button', { name: 'Activate', exact: true })).toBeVisible()
    await expect(bar(page).getByRole('button', { name: 'Deactivate' })).toBeVisible()
    await expect(bar(page).getByRole('button', { name: 'Remove' })).toBeVisible()
  })

  test('deactivating asks once and reports each alias domain', async ({ page, mockApi }) => {
    await mockApi.use('bulk-alias-domains-da')
    await startSelecting(page)
    await entry(page, BULK_ALIAS_DOMAINS_004[0]).getByRole('checkbox').click()
    await entry(page, BULK_ALIAS_DOMAINS_004[2]).getByRole('checkbox').click()
    await bar(page).getByRole('button', { name: 'Deactivate' }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toContainText('2')
    await dialog.getByRole('button', { name: 'Deactivate' }).click()
    await expect(page.locator('[data-bulk-summary]')).toContainText('2 done')
    await expect(page.locator('[data-bulk-summary]')).toContainText(
      `Changes to alias domain ${BULK_ALIAS_DOMAINS_004[0]} have been saved`,
    )
  })

  test('delete lists every name with the consequences and needs the typed count', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('bulk-alias-domains-da')
    await startSelecting(page)
    await entry(page, BULK_ALIAS_DOMAINS_004[0]).getByRole('checkbox').click()
    await entry(page, BULK_ALIAS_DOMAINS_004[1]).getByRole('checkbox').click()
    await bar(page).getByRole('button', { name: 'Remove' }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toContainText(BULK_ALIAS_DOMAINS_004[0])
    await expect(dialog).toContainText(BULK_ALIAS_DOMAINS_004[1])
    await expect(dialog).toContainText('DKIM')
    await expect(dialog.getByRole('button', { name: 'Delete now' })).toBeDisabled()
    await dialog.getByRole('textbox', { name: 'Type 2 to confirm' }).fill('2')
    await dialog.getByRole('button', { name: 'Delete now' }).click()
    await expect(page.locator('[data-bulk-summary]')).toContainText(
      `Alias domain ${BULK_ALIAS_DOMAINS_004[0]} has been removed`,
    )
    await expect(entry(page, BULK_ALIAS_DOMAINS_004[0])).toHaveCount(0)
  })

  test('temporary failures are reported with "try again" and stay selected', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('bulk-alias-domains-failures')
    await startSelecting(page)
    for (const name of BULK_ALIAS_DOMAINS_004) await entry(page, name).getByRole('checkbox').click()
    await bar(page).getByRole('button', { name: 'Activate', exact: true }).click()
    const summary = page.locator('[data-bulk-summary]')
    await expect(summary).toContainText('3 done')
    await expect(summary).toContainText('2 failed')
    await expect(summary).toContainText('temporarily unavailable')
    for (const name of FAILING_ALIAS_DOMAINS_004) await expect(summary).toContainText(name)
    await expect(bar(page)).toContainText('2 selected')
  })
})
