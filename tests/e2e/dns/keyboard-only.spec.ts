// UI 010 T106: the main paths with the keyboard alone, the focus visible at every step (FR-082):
// filtering and sorting the list, selection, copying, generation, the MX entry, the deactivation,
// the diagnostics filter, the zone file download and every dialog.
import type { Locator, Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { FIRST_LOAD, entryNames, isNarrow, listReady } from './helpers'

/** Tabs until the target has the focus (at most `max` steps), checking the focus is shown. */
async function tabTo(page: Page, target: Locator, max = 60) {
  for (let step = 0; step < max; step++) {
    if (await target.evaluate((element) => element === document.activeElement)) break
    await page.keyboard.press('Tab')
  }
  await expect(target).toBeFocused()
  const outline = await target.evaluate((element) => {
    const style = getComputedStyle(element)
    return style.outlineStyle !== 'none' || style.boxShadow !== 'none'
  })
  expect(outline, 'the focus is visible').toBe(true)
}

test.describe('DNS with the keyboard only', () => {
  test('the list is filtered and sorted, and an entry is selected', async ({ page, mockApi }) => {
    await mockApi.use('dns-admin')
    await page.goto('dns/dkim-keys')
    await listReady(page)
    await page.getByRole('heading', { level: 1 }).focus()
    const filters = page.getByRole('button', { name: /^Filters/ })
    await tabTo(page, filters)
    await page.keyboard.press('Enter')
    const missing = page.getByRole('checkbox', { name: 'Key missing' })
    await tabTo(page, missing)
    await page.keyboard.press('Space')
    await expect.poll(() => entryNames(page)).toEqual(['example.net', 'missing.example'])
    if (isNarrow(page)) {
      const sort = page.locator('#dkim-sort')
      await tabTo(page, sort)
      await sort.selectOption('state')
      await expect(page).toHaveURL(/sort=state/)
    }
    const select = page.getByRole('button', { name: 'Select', exact: true })
    await tabTo(page, select)
    await page.keyboard.press('Enter')
    const item = page.getByRole('checkbox', { name: 'Select example.net' })
    await tabTo(page, item)
    await page.keyboard.press('Space')
    await expect(page.getByRole('region', { name: 'Bulk actions' })).toContainText('1 selected')
  })

  test('a record value is copied and a key generated in the dialog', async ({
    page,
    mockApi,
    browserName,
  }) => {
    if (browserName === 'chromium') {
      await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
    }
    await mockApi.use('dns-admin')
    await page.goto('dns/dkim-keys/example.org')
    await page.getByRole('heading', { level: 1 }).focus({ timeout: FIRST_LOAD })
    const copy = page.getByRole('button', { name: 'Copy record value of example.org' })
    await tabTo(page, copy)
    await page.keyboard.press('Enter')
    await expect(
      page.getByRole('status').filter({ hasText: 'Text copied to clipboard!' }),
    ).toBeVisible()

    await page.goto('dns/dkim-keys/example.net')
    await page.getByRole('heading', { level: 1 }).focus({ timeout: FIRST_LOAD })
    const add = page.getByRole('button', { name: 'Add ARC/DKIM key' })
    await tabTo(page, add)
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await tabTo(page, dialog.getByRole('button', { name: 'Add', exact: true }), 10)
    await page.keyboard.press('Enter')
    await expect(page.getByText('Key valid')).toBeVisible()
  })

  test('MX servers are entered and the policy deactivated', async ({ page, mockApi }) => {
    await mockApi.use('dns-mta-sts')
    await page.goto('domains/example.org')
    const section = page.locator('#mta-sts')
    await expect(section).toBeVisible({ timeout: FIRST_LOAD })
    const edit = section.getByRole('button', { name: /^Edit/ })
    await edit.focus()
    await page.keyboard.press('Enter')
    const mx = section.getByLabel('MX server')
    await tabTo(page, mx, 20)
    await page.keyboard.press('End')
    await page.keyboard.type(',mx2.example.org')
    const active = section.getByRole('checkbox', { name: /Active/ })
    await tabTo(page, active, 10)
    await page.keyboard.press('Space')
    await tabTo(page, section.getByRole('button', { name: 'Save changes' }), 10)
    await page.keyboard.press('Enter')
    const ask = page.getByRole('alertdialog')
    await expect(ask).toBeVisible()
    await tabTo(page, ask.getByRole('button', { name: 'Deactivate' }), 5)
    await page.keyboard.press('Enter')
    await expect(section).toContainText('mx2.example.org')
  })

  test('the diagnostics filter and the zone file download', async ({ page, mockApi }) => {
    await mockApi.use('dns-diagnostics-all-statuses')
    await page.goto('dns/diagnostics/example.org')
    await page.getByRole('heading', { level: 1 }).focus({ timeout: FIRST_LOAD })
    const filter = page.getByRole('checkbox', { name: /need attention/ })
    await tabTo(page, filter, 80)
    await page.keyboard.press('Space')
    await expect(filter).toBeChecked()
    const download = page.getByRole('button', { name: 'Download' })
    await tabTo(page, download, 120)
    const saved = page.waitForEvent('download')
    await page.keyboard.press('Enter')
    expect((await saved).suggestedFilename()).toBe('example.org.txt')
  })
})
