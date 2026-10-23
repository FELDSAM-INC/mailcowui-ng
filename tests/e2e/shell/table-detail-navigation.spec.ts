import { expect, test } from '../fixtures/test'

for (const [path, scenario] of [
  ['domains', 'domains-60'],
  ['domain-templates', 'templates'],
  ['mailboxes', 'admin-mailboxes-30'],
  ['mailbox-templates', 'admin-templates'],
  ['aliases', 'aliases-60'],
  ['alias-domains', 'alias-domains-admin'],
  ['resources', 'resources'],
  ['routing/relayhosts', 'routing-admin-default'],
  ['administrators/admins', 'admins-three'],
  ['administrators/domain-admins', 'domain-admins-three'],
  ['api-keys', 'api-keys-many'],
  ['identity-providers/oauth2-apps', 'oauth2-many'],
  ['account/app-passwords', 'account-mailbox'],
  ['system/mass-mail/jobs', 'mass-mail-completed'],
] as const) {
  test(`row detail has a back link preserving list state: ${path}`, async ({ page, mockApi }) => {
    await page.setViewportSize({ width: 1366, height: 900 })
    await mockApi.use(scenario)
    await page.goto(`${path}?size=50`)
    const original = new URL(page.url()).pathname + new URL(page.url()).search
    await expect(page.locator('main table tbody tr').first()).toBeVisible()
    const rowLink = page.locator(`main table tbody a[href^="/ng/${path}/"]`).first()
    if (await rowLink.count()) {
      await expect(rowLink).toBeVisible()
      await rowLink.click()
    } else {
      await page.locator('tbody [data-row-action-trigger]').first().click()
      await page.getByRole('menuitem', { name: /^Edit/ }).click()
    }
    const back = page.locator('[data-detail-back]')
    await expect(back).toBeVisible()
    await expect(back).toHaveAttribute('type', 'button')
    const detail = page.url()
    await back.click()
    await expect(page).toHaveURL((url) => url.pathname + url.search === original)
    await expect(page.locator('[data-list-toolbar]').first()).toBeVisible()
    await page.goForward()
    await expect(page).toHaveURL(detail)
  })
}

test('audit validation stays visible in the mobile filter dialog', async ({ page, mockApi }) => {
  await page.setViewportSize({ width: 360, height: 780 })
  await mockApi.use('audit-records')
  await page.goto('audit-log')
  await page.locator('[data-filter-toggle]').click()
  const dialog = page.getByRole('dialog')
  const address = dialog.getByRole('textbox', { name: 'Client address', exact: true })
  await address.fill('192.0.2.300')
  await dialog.getByRole('button', { name: 'Apply filters', exact: true }).click()
  await expect(dialog).toBeVisible()
  await expect(address).toHaveAttribute('aria-invalid', 'true')
  await address.fill('192.0.2.1')
  await dialog.getByRole('button', { name: 'Apply filters', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page).toHaveURL(/address=192\.0\.2\.1/)
})

test('read-only templates retain presentation controls without selection or editing', async ({
  page,
  mockApi,
}) => {
  await page.setViewportSize({ width: 1366, height: 900 })
  await mockApi.use('domain-admin-templates')
  await page.goto('mailbox-templates')
  await expect(page.locator('[data-list-columns]')).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Select', exact: true })).toHaveCount(0)
  await expect(
    page.locator('tbody [data-row-action-trigger], tbody a[aria-label^="Edit:"]'),
  ).toHaveCount(0)
})

test('the app links preview uses the shared column and sort controls without changing saved order', async ({
  page,
  mockApi,
}) => {
  await page.setViewportSize({ width: 1366, height: 900 })
  await mockApi.use('app-links-three')
  await page.goto('system/customize/app-links')
  const listing = page.locator('[data-app-link-list]').first()
  const toolbar = listing.locator('[data-list-toolbar]')
  await expect(toolbar.getByRole('searchbox')).toBeVisible()
  await toolbar.locator('[data-list-columns]').click()
  await page.locator('[data-column-option="url"]').click()
  await page.keyboard.press('Escape')
  await expect(listing.locator('thead [data-column="url"]')).toBeHidden()
  await listing.locator('thead [data-column="name"] button').click()
  await expect(listing.locator('thead [data-column="name"]')).toHaveAttribute(
    'aria-sort',
    'ascending',
  )
})
