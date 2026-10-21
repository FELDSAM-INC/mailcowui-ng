import { expect, test } from '../fixtures/test'
import { clickRowAction } from '../fixtures/row-actions'

const cases = [
  ['domains', 'domains-60'],
  ['mailboxes', 'admin-mailboxes-30'],
  ['aliases', 'aliases-60'],
  ['alias-domains', 'alias-domains-admin'],
  ['filters', 'filters-many'],
  ['system/rspamd-rules', 'rspamd-rules-30'],
  ['resources', 'resources'],
  ['administrators/admins', 'admins-three'],
  ['quarantine', 'quarantine-admin'],
  ['routing/bcc-maps', 'routing-admin-default'],
  ['sync-jobs', 'sync-jobs-admin'],
] as const

test('row actions and disclosure controls share the final cell across lists', async ({
  page,
  mockApi,
}) => {
  await page.setViewportSize({ width: 1366, height: 900 })
  for (const [path, scenario] of cases) {
    await mockApi.use(scenario)
    await page.goto(path)
    const table = page.locator('main table.data-table').first()
    const row = table.locator('tbody > tr').first()
    const controls = row.locator('td:last-child .table-row-controls')
    await expect(controls, path).toBeVisible()
    expect(
      await row
        .locator(
          'td:not(:last-child) [data-row-expand], td:not(:last-child) [data-row-action-trigger]',
        )
        .count(),
      path,
    ).toBe(0)
    const geometry = await controls.evaluate((element) => {
      const cell = element.closest('td')!.getBoundingClientRect()
      return [...element.children].every((child) => {
        const rect = child.getBoundingClientRect()
        return rect.left >= cell.left && rect.right <= cell.right + 1
      })
    })
    expect(geometry, `${path}: controls fit inside their cell`).toBe(true)
    const expand = controls.locator('[data-row-expand]')
    if (await expand.count()) {
      await expect(expand).toHaveAttribute('aria-expanded', 'false')
      expect(
        await expand.evaluate((element) => element === element.parentElement!.firstElementChild),
      ).toBe(true)
      await expand.click()
      await expect(expand).toHaveAttribute('aria-expanded', 'true')
      await expand.click()
    }
    const menu = controls.locator('[data-row-action-trigger]')
    await expect(menu, path).toBeVisible()
    await menu.click()
    expect(await page.getByRole('menuitem').count(), path).toBeGreaterThan(1)
    await expect(page.getByRole('menuitem', { name: /History/i })).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expect(menu).toBeFocused()
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      path,
    ).toBe(true)
  }
})

test('domain tags are available only inside collapsed row details', async ({ page, mockApi }) => {
  await page.setViewportSize({ width: 1366, height: 900 })
  await mockApi.use('domains-60')
  await page.goto('domains')
  const row = page.locator('[data-entry="customer-a.example"]')
  await expect(row).toBeVisible()
  await expect(row.getByRole('button', { name: /Filter by tag/ })).toHaveCount(0)
  const details = page.locator('[data-entry-details="customer-a.example"]')
  await expect(details).toHaveCount(0)
  await row.locator('[data-row-expand]').click()
  await expect(
    details.getByRole('button', { name: 'Filter by tag gold', exact: true }),
  ).toBeVisible()
  await row.locator('[data-row-expand]').click()
  await expect(details).toHaveCount(0)
})

test('single Edit actions bypass the menu and mailbox deletion returns focus after Cancel', async ({
  page,
  mockApi,
}) => {
  await page.setViewportSize({ width: 1366, height: 900 })
  await mockApi.use('templates')
  await page.goto('domain-templates')
  const template = page
    .locator('main table tbody tr')
    .filter({ has: page.getByRole('link', { name: 'Default', exact: true }) })
  await expect(
    template.locator('td:last-child').getByRole('link', { name: 'Edit: Default', exact: true }),
  ).toBeVisible()
  await expect(template.locator('[data-row-action-trigger]')).toHaveCount(0)
  await mockApi.use('admin-delete')
  await page.goto('mailboxes?q=big')
  const row = page.locator('[data-entry="big@a.example"]')
  await clickRowAction(page, row, 'Remove big@a.example')
  const dialog = page.getByRole('alertdialog')
  await expect(dialog.getByRole('heading', { name: 'Confirm deletion' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused()
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(row.locator('[data-row-action-trigger]')).toBeFocused()
  await expect(row).toBeVisible()
})

test('mailbox menu keeps sign-in-as and returns to the filtered list', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('acting-admin')
  await page.goto('mailboxes?q=alice')
  await clickRowAction(
    page,
    page.locator('[data-entry="alice@example.org"]'),
    'Login alice@example.org',
  )
  await expect(page.locator('[data-acting-banner]')).toContainText('alice@example.org')
  await page.locator('[data-acting-return]').click()
  await expect(page).toHaveURL(/mailboxes\?q=alice$/)
  await expect(
    page.locator('[data-entry="alice@example.org"] [data-row-action-trigger]'),
  ).toBeVisible()
})

test('a direct Edit fits beside expansion and Sync Jobs keeps logs in its final menu', async ({
  page,
  mockApi,
}) => {
  await page.setViewportSize({ width: 1366, height: 900 })
  await mockApi.use('filters-domain-admin-no-flag')
  await page.goto('filters')
  const filter = page.locator('main table tbody tr').first()
  const controls = filter.locator('td:last-child .table-row-controls')
  await expect(controls.getByRole('link', { name: /^Edit:/ })).toBeVisible()
  await expect(controls.locator('[data-row-action-trigger]')).toHaveCount(0)
  expect(
    await controls.evaluate((element) => {
      const cell = element.closest('td')!.getBoundingClientRect()
      return [...element.children].every((child) => {
        const rect = child.getBoundingClientRect()
        return rect.left >= cell.left && rect.right <= cell.right + 1
      })
    }),
  ).toBe(true)
  await mockApi.use('sync-jobs-admin')
  await page.goto('sync-jobs')
  const job = page.locator('main table tbody tr').first()
  await expect(job.locator('td:not(:last-child) button')).toHaveCount(0)
  await job.locator('[data-row-action-trigger]').click()
  await expect(page.getByRole('menuitem', { name: /logs/i })).toBeVisible()
  await page.getByRole('menuitem', { name: /logs/i }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
})
