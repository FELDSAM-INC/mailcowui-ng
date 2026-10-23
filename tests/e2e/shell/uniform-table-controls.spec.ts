import { expect, test } from '../fixtures/test'

const lists = [
  ['domains', 'domains-60'],
  ['domain-templates', 'templates'],
  ['mailboxes', 'admin-mailboxes-30'],
  ['mailbox-templates', 'admin-templates'],
  ['aliases', 'aliases-60'],
  ['alias-domains', 'alias-domains-admin'],
  ['resources', 'resources'],
  ['sync-jobs', 'sync-jobs-admin'],
  ['dns/dkim-keys', 'dns-admin'],
  ['dns/mta-sts-policies', 'dns-mta-sts'],
  ['identity-providers/oauth2-apps', 'oauth2-many'],
  ['filters', 'filters-many'],
  ['routing/bcc-maps', 'routing-admin-default'],
  ['routing/recipient-maps', 'routing-admin-default'],
  ['routing/tls-policy-maps', 'routing-admin-default'],
  ['routing/relayhosts', 'routing-admin-default'],
  ['routing/transports', 'routing-admin-default'],
  ['routing/forwarding-hosts', 'routing-admin-default'],
  ['quarantine/rate-limits', 'rate-limits-admin'],
  ['administrators/admins', 'admins-three'],
  ['administrators/domain-admins', 'domain-admins-three'],
  ['api-keys', 'api-keys-many'],
  ['quarantine', 'quarantine-mailbox-user'],
  ['operations/mail-queue', 'admin-operations'],
  ['operations/logs/postfix', 'admin-operations'],
  ['operations/logs/rspamd', 'ops-rspamd'],
  ['audit-log', 'audit-records'],
  ['account/app-passwords', 'account-mailbox'],
  ['account/temporary-aliases', 'temporary-aliases-many'],
  ['account/recent-logins', 'account-recent-logins'],
  ['system/rspamd-rules', 'rspamd-rules-30'],
  ['system/mass-mail/jobs', 'mass-mail-completed'],
] as const

for (const [path, scenario] of lists) {
  test(`shared toolbar, header sorting and hideable default columns: ${path}`, async ({
    page,
    mockApi,
  }) => {
    await page.setViewportSize({ width: 1366, height: 900 })
    await mockApi.use(scenario)
    await page.goto(path)
    const toolbar = page.locator('[data-list-toolbar]')
    await expect(toolbar).toHaveCount(1)
    await expect(toolbar.getByRole('searchbox')).toBeVisible()
    const columns = toolbar.locator('[data-list-columns]')
    await expect(columns).toBeEnabled()
    await expect(page.getByRole('combobox', { name: 'Sort by', exact: true })).toHaveCount(0)
    await expect(page.getByRole('combobox', { name: 'Order', exact: true })).toHaveCount(0)
    const table = page.locator('main table.data-table').first()
    const headers = table.locator('thead th[data-column]')
    await expect(headers.first()).toBeVisible()
    const header = headers.nth(1)
    const key = await header.getAttribute('data-column')
    const label = (await header.innerText()).trim()
    await columns.click()
    const option = page.locator(`[data-column-option="${key}"]`)
    await expect(option).toHaveAttribute('aria-checked', 'true')
    await option.click()
    await page.keyboard.press('Escape')
    await expect(header).toBeHidden()
    await page.reload()
    await expect(page.locator('[data-list-columns]')).toBeEnabled()
    await expect(table.getByRole('columnheader', { name: label, exact: true })).toHaveCount(0)
    await page.locator('[data-list-columns]').click()
    await expect(page.locator(`[data-column-option="${key}"]`)).toHaveAttribute(
      'aria-checked',
      'false',
    )
    await page.locator(`[data-column-option="${key}"]`).click()
    await page.keyboard.press('Escape')
    const sortable = headers.filter({ has: page.getByRole('button') }).first()
    const before = await sortable.getAttribute('aria-sort')
    await sortable.getByRole('button').click()
    await expect(sortable).toHaveAttribute(
      'aria-sort',
      before === 'ascending' ? 'descending' : 'ascending',
    )
  })
}

for (const [path, scenario] of lists) {
  test(`mobile toolbar retains sorting and usable filters: ${path}`, async ({ page, mockApi }) => {
    await page.setViewportSize({ width: 360, height: 780 })
    await mockApi.use(scenario)
    await page.goto(path)
    const toolbar = page.locator('[data-list-toolbar]')
    const columns = toolbar.locator('[data-list-columns]')
    await expect(columns).toBeEnabled()
    await columns.click()
    await expect(page.getByRole('menuitem').first()).toBeVisible()
    await page.getByRole('menuitem').first().click()
    await expect(columns).toBeFocused()
    const filters = toolbar.locator('[data-filter-toggle]')
    if (await filters.count()) {
      await filters.click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await expect(page.getByRole('dialog').locator('[data-filter-panel]')).toBeVisible()
      await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click()
      await expect(filters).toBeFocused()
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}
