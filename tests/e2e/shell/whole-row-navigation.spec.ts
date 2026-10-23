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
  ['filters', 'filters-many'],
  ['dns/dkim-keys', 'dns-admin'],
  ['dns/mta-sts-policies', 'dns-mta-sts'],
  ['routing/bcc-maps', 'routing-admin-default'],
  ['routing/recipient-maps', 'routing-admin-default'],
  ['routing/tls-policy-maps', 'routing-admin-default'],
  ['routing/relayhosts', 'routing-admin-default'],
  ['routing/transports', 'routing-admin-default'],
  ['quarantine/rate-limits', 'rate-limits-admin'],
  ['administrators/admins', 'admins-three'],
  ['administrators/domain-admins', 'domain-admins-three'],
  ['api-keys', 'api-keys-many'],
  ['identity-providers/oauth2-apps', 'oauth2-many'],
  ['account/app-passwords', 'account-mailbox'],
  ['quarantine', 'quarantine-mailbox-user'],
  ['operations/mail-queue', 'admin-operations'],
  ['system/rspamd-rules', 'rspamd-rules-30'],
  ['system/mass-mail/jobs', 'mass-mail-completed'],
] as const

for (const [path, scenario] of lists) {
  test(`whole row and mobile card open the object: ${path}`, async ({ page, mockApi }) => {
    await mockApi.use(scenario)
    for (const width of [1366, 360]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(path)
      const record = page
        .locator(width === 1366 ? 'main tbody [data-row-link]' : 'main [data-card][data-row-link]')
        .first()
      await expect(record).toBeVisible()
      if (path === 'administrators/admins') {
        await record.focus()
        await page.screenshot({
          path: test.info().outputPath(`rows-${width}.png`),
          animations: 'disabled',
        })
      }
      const href = await record.getAttribute('data-row-href')
      expect(href).toBeTruthy()
      const value = record.locator(width === 1366 ? 'td[data-column]:visible' : 'dd:visible').last()
      await expect(record.locator(width === 1366 ? 'td[data-column] a' : 'h3 a')).toHaveCount(0)
      if (await value.count()) await value.click()
      else await record.locator('h3').click()
      await expect(page).toHaveURL((url) => url.pathname === new URL(href!, page.url()).pathname)
      await page.goBack()
      await expect(record).toBeVisible()
    }
  })
}

for (const width of [1366, 360]) {
  test(`row controls and text selection do not navigate at ${width}px`, async ({
    page,
    mockApi,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await mockApi.use('domains-60')
    await page.goto('domains?q=customer-a')
    const record = page.locator('[data-row-link][data-entry="customer-a.example"]')
    await expect(record).toBeVisible()
    const original = page.url()
    await page.getByRole('button', { name: 'Select', exact: true }).click()
    const checkbox = record.getByRole('checkbox')
    await checkbox.check()
    await expect(checkbox).toBeChecked()
    await expect(page).toHaveURL(original)
    const expand = record.locator(width === 1366 ? '[data-row-expand]' : '[data-card-expand]')
    await expand.click()
    await expect(expand).toHaveAttribute('aria-expanded', 'true')
    await expect(page).toHaveURL(original)
    await record.locator('[data-row-action-trigger]').click()
    await expect(page.getByRole('menu')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page).toHaveURL(original)
    const text = record.locator('[data-identity-text]').first()
    await text.evaluate((element) => {
      const range = document.createRange()
      range.selectNodeContents(element)
      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)
      element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await expect(page).toHaveURL(original)
    await page.evaluate(() => window.getSelection()?.removeAllRanges())
    const href = await record.getAttribute('data-row-href')
    await record.focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL((url) => url.pathname === new URL(href!, page.url()).pathname)
  })
}

test('modified clicks open a row in another tab', async ({ page, mockApi }) => {
  await page.setViewportSize({ width: 1366, height: 900 })
  await mockApi.use('admins-three')
  await page.goto('administrators/admins')
  const row = page.locator('tbody [data-row-link]').first()
  const href = await row.getAttribute('data-row-href')
  const original = page.url()
  const popupReady = page.waitForEvent('popup')
  await row
    .locator('td[data-column]')
    .last()
    .click({ modifiers: ['Control'] })
  const popup = await popupReady
  await expect(popup).toHaveURL((url) => url.pathname === new URL(href!, page.url()).pathname)
  await expect(page).toHaveURL(original)
  await popup.close()
})

test('read-only log rows do not pretend to have object pages', async ({ page, mockApi }) => {
  await mockApi.use('account-recent-logins')
  await page.goto('account/recent-logins')
  await expect(page.locator('[data-list-toolbar]')).toBeVisible()
  await expect(page.locator('main [data-row-link]')).toHaveCount(0)
})

test('relayhost usage stays available in actions and its rows open their objects', async ({
  page,
  mockApi,
}) => {
  await page.setViewportSize({ width: 1366, height: 900 })
  await mockApi.use('routing-admin-default')
  await page.goto('routing/relayhosts')
  const row = page.locator('[data-entry="2"]')
  await row.locator('[data-row-action-trigger]').click()
  await page.getByRole('menuitem', { name: /^In use by/ }).click()
  await expect(page).toHaveURL(/routing\/relayhosts\/2\/usage$/)
  const domain = page.locator('[data-row-link][data-entry="domain:example.org"]')
  await expect(domain).toBeVisible()
  await domain.press('Enter')
  await expect(page).toHaveURL(/\/domains\/example.org$/)
})

test('DKIM selector filtering is available in Filters', async ({ page, mockApi }) => {
  await page.setViewportSize({ width: 360, height: 900 })
  await mockApi.use('dns-admin')
  await page.goto('dns/dkim-keys')
  await page.locator('[data-filter-toggle]').click()
  const selector = page.locator('#dkim-filter-selector')
  await selector.fill('shop')
  await selector.press('Tab')
  await expect(page).toHaveURL(/selector=shop/)
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(page.locator('[data-card][data-row-link]')).toHaveCount(1)
  await expect(page.locator('[data-card][data-row-link]')).toContainText('shop.example')
})
