import { expect, test } from '../fixtures/test'
import { pick } from '../aliases/helpers'

const rows = '[data-filter-id]'

test('filters list defaults to descending IDs, pages, searches and restores URL filters', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('filters-many')
  await page.goto('filters')
  await expect(page.locator(rows)).toHaveCount(25)
  await expect(page.locator(rows).first()).toHaveAttribute('data-filter-id', '40')
  await expect(page.getByText('Showing 1 to 25 of 40 entries')).toBeVisible()
  await expectAccessible()
  await expectNoHorizontalScroll()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page).toHaveURL(/page=2/)
  await expect(page.locator(rows)).toHaveCount(15)
  await page.getByRole('combobox', { name: /^Filter type/ }).selectOption('prefilter')
  await expect(page).not.toHaveURL(/page=/)
  await expect(page.locator(rows)).toHaveCount(20)
  await page.getByRole('searchbox', { name: 'Search:', exact: true }).fill('SPAM')
  await expect(page.locator(rows)).toHaveCount(1)
  await expect(page.locator(rows)).toContainText('Spam to folder')
  await page.getByRole('combobox', { name: 'Sort by', exact: true }).selectOption('description')
  await expect(page).toHaveURL(/sort=description/)
  await page.getByRole('combobox', { name: 'Active', exact: true }).selectOption('no')
  await expect(page.getByRole('main')).toContainText('No matching records found')
  await page.goBack()
  await expect(page.locator(rows)).toHaveCount(1)
  await page.locator(rows).locator('summary').click()
  await expect(page.locator(rows).locator('pre')).toContainText('fileinto')
  await page.evaluate(() => window.scrollTo(0, 0))
  await expectAccessible()
})

test('creation validates before Add, edits invalidate validation, and activation replaces its kind only', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('filters-many')
  await page.goto('filters/new')
  const form = page.locator('[data-filter-form]')
  await pick(page, /^Username/, 'anna', 'anna@example.org')
  await page.getByLabel(/^Short description/).fill('New prefilter')
  await page.getByLabel(/^Script/).fill('unknown_command;')
  await expect(form.getByRole('button', { name: 'Add', exact: true })).toBeDisabled()
  await form.getByRole('button', { name: 'Validate', exact: true }).click()
  await expect(page.getByLabel(/^Script/)).toHaveAttribute('aria-invalid', 'true')
  await expect(form).toContainText("unknown command 'unknown_command'")
  expect(await mockApi.countRequests('createSieveFilter')).toBe(0)
  await expectAccessible()
  await page.getByLabel(/^Script/).fill('keep;')
  await form.getByRole('button', { name: 'Validate', exact: true }).click()
  await expect(form.getByRole('button', { name: 'Add', exact: true })).toBeEnabled()
  await page.getByLabel(/^Short description/).fill('New prefilter final')
  await expect(form.getByRole('button', { name: 'Add', exact: true })).toBeDisabled()
  await form.getByRole('button', { name: 'Validate', exact: true }).click()
  await expect(form).toContainText('All other filters will be deactivated, when active is checked.')
  await form.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page).toHaveURL(/filters\/100$/)
  await expect(page.getByLabel(/^Short description/)).toHaveValue('New prefilter final')
  await expectAccessible()
  await expectNoHorizontalScroll()
  await page.getByRole('link', { name: 'Filters', exact: true }).last().click()
  await page.getByRole('combobox', { name: 'Active', exact: true }).selectOption('yes')
  await expect(page.locator(rows)).toHaveCount(4)
  await expect(page.locator('[data-filter-id="1"]')).toHaveCount(0)
  await expect(page.locator('[data-filter-id="2"]')).toBeVisible()
  await expect(page.locator('[data-filter-id="100"]')).toBeVisible()
})

test('editing validates and saves together, shows parser errors, resolves 412 with draft retained and switches kind', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('filters-many')
  await page.goto('filters/1')
  const form = page.locator('[data-filter-form]')
  await expect(page.getByLabel(/^Short description/)).toHaveValue('Spam to folder')
  await page.getByLabel(/^Script/).fill('unknown_command;')
  await form.getByRole('button', { name: 'Validate and save', exact: true }).click()
  await expect(form).toContainText('unknown command')
  expect(await mockApi.countRequests('updateSieveFilter')).toBe(0)
  await page.getByLabel(/^Script/).fill('keep;')
  await page.getByLabel(/^Short description/).fill('My draft')
  await page.getByRole('combobox', { name: /^Filter type/ }).selectOption('postfilter')
  await mockApi.patch({
    selfService: { setFilters: { '1': { description: 'Changed elsewhere' } } },
  })
  await form.getByRole('button', { name: 'Validate and save', exact: true }).click()
  await expect(page.locator('[data-outdated]')).toContainText('Changed elsewhere')
  await expect(page.getByLabel(/^Short description/)).toHaveValue('My draft')
  await expect(page.getByLabel(/^Script/)).toHaveValue('keep;')
  await expectAccessible()
  await form.getByRole('button', { name: 'Save again', exact: true }).click()
  await expect(page.locator('[data-outdated]')).toHaveCount(0)
  const updates = (await mockApi.requests()).filter(
    (request) => request.operationId === 'updateSieveFilter',
  )
  expect(updates).toHaveLength(2)
  await page.goto('filters?mailbox=anna%40example.org&active=yes')
  await expect(page.locator(rows)).toHaveCount(1)
  await expect(page.locator('[data-filter-id="1"]')).toContainText('Postfilter')
  await expect(page.locator('[data-filter-id="2"]')).toHaveCount(0)
})

test('bulk actions show each result and a retry; deletion names entries and requires the count', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('filters-many')
  await page.goto('filters?size=50')
  await page.getByRole('button', { name: 'Select', exact: true }).click()
  await page.locator('[data-filter-id="1"]').getByRole('checkbox').check()
  await page.locator('[data-filter-id="2"]').getByRole('checkbox').check()
  await mockApi.failNext('updateSieveFilter', { type: 'internal-error', status: 500 })
  await page.getByRole('button', { name: 'Deactivate', exact: true }).click()
  const outcomes = page.getByRole('region', { name: 'Results', exact: true })
  await expect(outcomes).toContainText('Failed')
  await expect(outcomes).toContainText('Done')
  // Keep the final row above the sticky bar before measuring pointer targets. The preceding
  // action leaves this row below the viewport; keyboard focus must reveal its complete actions.
  const lastRow = page.locator('[data-filter-id="1"]')
  await lastRow.getByRole('button', { name: 'Remove: Spam to folder', exact: true }).focus()
  await expect
    .poll(() =>
      lastRow.getByRole('link').evaluate((element) => {
        const bounds = element.getBoundingClientRect()
        const bar = document.querySelector('[data-bulk-bar]')!.getBoundingClientRect()
        return (
          bounds.width >= 44 && bounds.height >= 44 && bounds.top >= 64 && bounds.bottom <= bar.top
        )
      }),
    )
    .toBe(true)
  await expectAccessible()
  await outcomes.getByRole('button', { name: 'Retry the failed ones', exact: true }).click()
  await expect(outcomes).not.toContainText('Failed')
  await outcomes.getByRole('button', { name: 'Close', exact: true }).click()
  await page.locator('[data-filter-id="1"]').getByRole('checkbox').check()
  await page.locator('[data-filter-id="2"]').getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Remove', exact: true }).click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toContainText('Spam to folder (anna@example.org)')
  await expect(dialog).not.toContainText('ActiveSync')
  await expect(dialog.getByRole('button', { name: 'Delete now', exact: true })).toBeDisabled()
  await dialog.getByRole('textbox').fill('2')
  await dialog.getByRole('button', { name: 'Delete now', exact: true }).click()
  await expect(page.locator('[data-filter-id="1"]')).toHaveCount(0)
  await expect(page.locator('[data-filter-id="2"]')).toHaveCount(0)
  await expect(outcomes).toContainText('Deleted filters ID 1')
  await expect(outcomes).toContainText('Deleted filters ID 2')
  await page
    .locator('[data-filter-id="3"]')
    .getByRole('button', { name: 'Remove: Rule 03', exact: true })
    .click()
  await expect(dialog.getByRole('textbox')).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Delete now', exact: true }).click()
  await expect(page.locator('[data-filter-id="3"]')).toHaveCount(0)
})

test('read-only domain administrators see metadata and scripts; their direct create URL is denied', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('filters-domain-admin-no-flag')
  await page.goto('filters')
  await expect(page.locator(rows)).toHaveCount(25)
  await expect(page.locator('[data-acl-note]')).toContainText('Prohibited by ACLFilters')
  await expect(page.getByRole('link', { name: 'Add filter', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Remove:/ })).toHaveCount(0)
  await page.locator('[data-filter-id="40"]').getByRole('link').click()
  await expect(page.locator('[data-filter-form]')).toHaveCount(0)
  await expect(page.locator('pre')).toContainText('fileinto')
  await expectAccessible()
  await page.goto('filters/new')
  await expect(page.getByRole('heading', { name: 'No access', exact: true })).toBeVisible()
  expect(await mockApi.countRequests('createSieveFilter')).toBe(0)
})

test('the editor contains long lines at 320px, rejects oversized UTF-8 scripts and guards unsaved changes', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('filters-domain-admin')
  await page.goto('filters/new')
  await pick(page, /^Username/, 'anna', 'anna@example.org')
  await page.getByLabel(/^Short description/).fill('Long rule')
  const script = page.getByLabel(/^Script/)
  await script.fill(`#${'é'.repeat(32768)}`)
  await expect(script).toHaveAttribute('wrap', 'soft')
  await expect(script).toHaveAttribute('autocapitalize', 'off')
  await expect(script).toHaveAttribute('autocorrect', 'off')
  await expect(script).toHaveAttribute('spellcheck', 'false')
  await page.getByRole('button', { name: 'Validate', exact: true }).click()
  await expect(script).toHaveAttribute('aria-invalid', 'true')
  await expect(page.locator('[data-filter-form]')).toContainText('65,535')
  await expectAccessible()
  await expectNoHorizontalScroll(page, { widths: [320, 360] })
  await page.getByRole('link', { name: 'Filters', exact: true }).last().click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Stay', exact: true }).click()
  await expect(script).toHaveValue(`#${'é'.repeat(32768)}`)
  await script.fill('keep;')
  await page.getByRole('button', { name: 'Validate', exact: true }).click()
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page).toHaveURL(/filters\/100$/)
})

test('failed list reads retry and missing detail IDs show not found', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('filters-many')
  await mockApi.failNext('listSieveFilters', { type: 'internal-error', status: 500 })
  await page.goto('filters')
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(page.locator(rows)).toHaveCount(25)
  await page.goto('filters/999')
  await expect(page.getByRole('heading', { name: 'Page not found', exact: true })).toBeVisible()
  await expectAccessible()
})
