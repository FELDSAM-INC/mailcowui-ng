import { expect, test } from '../fixtures/test'

test('empty explanation, legacy generation defaults, raw copy, permanence and confirmed removal', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('temporary-aliases-empty')
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: (text: string) => {
          ;(window as unknown as { copied: string }).copied = text
          return Promise.resolve()
        },
      },
    }),
  )
  await page.goto('account/temporary-aliases')
  await expect(page.getByRole('heading', { name: 'Spam email aliases', exact: true })).toBeVisible()
  await expect(page.getByRole('main')).toContainText('A spam alias is a temporary email address')
  await expect(page.getByRole('main')).toContainText('No data available in table')
  await page.getByText('Generate random alias', { exact: true }).click()
  await expect(page.getByLabel('Period of validity', { exact: true })).toHaveValue('8760')
  await page.getByLabel('Domain', { exact: true }).selectOption('example.com')
  await page.getByLabel('Description', { exact: true }).fill('Shop')
  await expectAccessible()
  await expectNoHorizontalScroll()
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  const result = page.locator('[data-new-alias]')
  await expect(result).toBeVisible()
  const copy = result.getByRole('button', { name: /^Copy: / })
  const address = (await copy.getAttribute('aria-label'))!.slice('Copy: '.length)
  expect(address).toMatch(/^[a-z]{6,8}\.[a-z]{6,8}@example.com$/)
  await copy.click()
  expect(await page.evaluate(() => (window as unknown as { copied: string }).copied)).toBe(address)
  const row = page.locator('[data-entry]').filter({ hasText: address })
  await expect(row).toContainText('Shop')
  await expect(row.locator('time')).toHaveCount(3)
  if (await row.locator('[data-row-action-trigger]').count())
    await clickRowAction(page, row, 'Never Expire')
  else
    await row
      .getByRole('combobox', { name: `Actions: ${address}`, exact: true })
      .selectOption('permanent')
  await expect(row).toContainText('Forever')
  await expectAccessible()
  await expectNoHorizontalScroll()
  await clickRowAction(page, row, `Remove: ${address}`)
  await expect(page.getByRole('alertdialog')).toContainText(address)
  await page.getByRole('button', { name: 'Delete now', exact: true }).click()
  await expect(row).toHaveCount(0)
})

test('one domain hides its choice and validity follows the pinned capability range', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('temporary-aliases-single-domain')
  await page.goto('account/temporary-aliases')
  await page.getByText('Generate random alias', { exact: true }).click()
  await expect(page.getByLabel('Period of validity', { exact: true })).toHaveValue('8760')
  await expect(page.getByLabel('Domain', { exact: true })).toHaveCount(0)
  await expect(page.getByLabel('Period of validity', { exact: true }).locator('option')).toHaveText(
    ['1 hour', '1 day', '1 week', '1 month', '1 year', '10 years', 'Never Expire'],
  )
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.locator('[data-new-alias]')).toContainText('@example.org')
})

test('bulk validity reports each alias, keeps failures selected and retries with fresh versions', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('temporary-aliases-many')
  await page.goto('account/temporary-aliases?sort=address')
  await page.getByRole('button', { name: 'Select', exact: true }).click()
  await page.getByRole('checkbox', { name: 'alias01@example.org', exact: true }).check()
  await page.getByRole('checkbox', { name: 'alias02@example.org', exact: true }).check()
  await page
    .locator('[data-bulk-bar]')
    .getByRole('combobox', { name: 'Actions', exact: true })
    .selectOption('168')
  const results = page.getByRole('region', { name: 'Results', exact: true })
  await expect(results).toContainText('1 done')
  await expect(results).toContainText('1 changed in the meantime')
  await expect(
    page.getByRole('checkbox', { name: 'alias01@example.org', exact: true }),
  ).toBeChecked()
  await expect(
    page.getByRole('checkbox', { name: 'alias02@example.org', exact: true }),
  ).not.toBeChecked()
  await mockApi.patch({
    selfService: { setTemporaryAliases: { 'alias01@example.org': { failWith: 0 } } },
  })
  await results.getByRole('button', { name: 'Refresh the list', exact: true }).click()
  await results.getByRole('button', { name: 'Retry the failed ones' }).click()
  await expect(results).toContainText('1 done')
  await expect(results).not.toContainText('changed in the meantime')
})

test('bulk deletion names aliases and requires the selected count', async ({ page, mockApi }) => {
  await mockApi.use('temporary-aliases-many')
  await page.goto('account/temporary-aliases?sort=address')
  await page.getByRole('button', { name: 'Select', exact: true }).click()
  await page.getByRole('checkbox', { name: 'alias02@example.org', exact: true }).check()
  await page.getByRole('checkbox', { name: 'alias03@example.org', exact: true }).check()
  await page.locator('[data-bulk-bar]').getByRole('button', { name: 'Remove', exact: true }).click()
  const confirmation = page.getByRole('alertdialog')
  await expect(confirmation).toContainText('alias02@example.org')
  await expect(confirmation).toContainText('alias03@example.org')
  await expect(confirmation.getByRole('button', { name: 'Delete now' })).toBeDisabled()
  await confirmation.getByLabel('Type 2 to confirm').fill('2')
  await confirmation.getByRole('button', { name: 'Delete now' }).click()
  await expect(page.locator('[data-entry="alias02@example.org"]')).toHaveCount(0)
  await expect(page.locator('[data-entry="alias03@example.org"]')).toHaveCount(0)
})

test('sort, paging and filters preserve URLs and clear selection, including browser Back', async ({
  page,
  mockApi,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('temporary-aliases-many')
  await page.goto('account/temporary-aliases')
  await expect(page.getByRole('combobox', { name: 'Sort by', exact: true })).toHaveValue(
    'expiresAt',
  )
  await page.getByRole('button', { name: 'Select', exact: true }).click()
  await page.getByRole('button', { name: 'Toggle all', exact: true }).click()
  await expect(page.locator('[data-bulk-bar]')).toContainText('25 selected')
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page).toHaveURL(/page=2/)
  await expect(page.locator('[data-bulk-bar]')).toContainText('0 selected')
  await expect(page.locator('[data-entry]')).toHaveCount(5)
  await page.getByRole('button', { name: 'Toggle all', exact: true }).click()
  await page.getByRole('combobox', { name: 'Sort by', exact: true }).selectOption('address')
  await expect(page).toHaveURL(/sort=address/)
  await expect(page.locator('[data-bulk-bar]')).toContainText('0 selected')
  await page.getByRole('button', { name: 'Toggle all', exact: true }).click()
  await page.getByRole('combobox', { name: 'Forever', exact: true }).selectOption('true')
  await expect(page.locator('[data-entry]')).toHaveCount(10)
  await expect(page.locator('[data-bulk-bar]')).toContainText('0 selected')
  await expect(page).toHaveURL(/permanent=true/)
  await page.goBack()
  await expect(page.getByRole('combobox', { name: 'Forever', exact: true })).toHaveValue('')
  await page.getByRole('searchbox', { name: 'Search:' }).fill('alias29')
  await expect(page.locator('[data-entry]')).toHaveCount(1)
  await expect(page).toHaveURL(/q=alias29/)
  await expectNoHorizontalScroll()
})

test('a lost connection reports outcome unknown and never retries the write', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('temporary-aliases-many')
  await page.goto('account/temporary-aliases?sort=address')
  let writes = 0
  await page.route('**/api/v2/mailboxes/*/temporary-aliases/*', async (route) => {
    if (route.request().method() === 'PATCH') {
      writes++
      await route.abort('connectionreset')
    } else await route.continue()
  })
  await page.getByRole('button', { name: 'Select', exact: true }).click()
  await page.getByRole('checkbox', { name: 'alias02@example.org', exact: true }).check()
  await page
    .locator('[data-bulk-bar]')
    .getByRole('combobox', { name: 'Actions', exact: true })
    .selectOption('permanent')
  const results = page.getByRole('region', { name: 'Results', exact: true })
  await expect(results).toContainText('Outcome unknown')
  await expect(results.getByRole('button', { name: 'Retry the failed ones' })).toHaveCount(0)
  expect(writes).toBe(1)
})

test('an alias expired meanwhile reports not found and disappears after refresh', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('temporary-alias-expired-meanwhile')
  await page.goto('account/temporary-aliases')
  const row = page.locator('[data-entry]')
  await expect(row).toHaveCount(1)
  await mockApi.patch({
    selfService: {
      setTemporaryAliases: {
        'bavoki.rumesa@example.org': { expiresAt: 1 },
      },
    },
  })
  if (await row.locator('[data-row-action-trigger]').count())
    await clickRowAction(page, row, 'Never Expire')
  else await row.getByRole('combobox', { name: /^Actions:/ }).selectOption('permanent')
  await expect(page.getByRole('region', { name: 'Results', exact: true })).toContainText(
    'not found',
  )
  await expect(row).toHaveCount(0)
})

test('the spamAlias flag gates own access and generation failures retain the draft', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('temporary-aliases-empty')
  await mockApi.patch({ selfService: { outages: { addressGeneration: true } } })
  await page.goto('account/temporary-aliases')
  await page.getByText('Generate random alias', { exact: true }).click()
  await page.getByLabel('Description', { exact: true }).fill('Retained')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByLabel('Description', { exact: true })).toHaveValue('Retained')
  await expect(page.locator('[data-generate-alias] [role="alert"]')).toBeVisible()
  await mockApi.use('account-mailbox-no-flags')
  await page.goto('account/temporary-aliases')
  await expect(page.getByRole('heading', { name: 'No access', exact: true })).toBeVisible()
})
import { clickRowAction } from '../fixtures/row-actions'
