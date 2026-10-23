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
  ['dns/mta-sts-policies', 'dns-mta-sts'],
  ['routing/bcc-maps', 'routing-admin-default'],
  ['routing/recipient-maps', 'routing-admin-default'],
  ['routing/tls-policy-maps', 'routing-admin-default'],
  ['routing/relayhosts', 'routing-admin-default'],
  ['routing/transports', 'routing-admin-default'],
  ['administrators/admins', 'admins-three'],
  ['administrators/domain-admins', 'domain-admins-three'],
  ['api-keys', 'api-keys-many'],
  ['account/app-passwords', 'account-mailbox'],
  ['system/rspamd-rules', 'rspamd-rules-30'],
] as const

for (const [path, scenario] of lists) {
  test(`shared inline status badges: ${path}`, async ({ page, mockApi }) => {
    await page.setViewportSize({ width: 1366, height: 900 })
    await mockApi.use(scenario)
    await page.goto(path)
    const cell = page
      .locator('tbody [data-column]')
      .filter({ has: page.locator('[data-identity] [data-slot="badge"]') })
      .first()
    await expect(cell).toBeVisible()
    const identity = cell.locator('[data-identity]').first()
    const badge = identity.locator('[data-slot="badge"]').first()
    await expect(badge).toBeVisible()
    // The row's name and state share one flex line; they may wrap only when space runs out.
    expect(await identity.evaluate((el) => getComputedStyle(el).flexDirection)).toBe('row')
    const text = await identity.locator('[data-identity-text]').boundingBox()
    const status = await badge.boundingBox()
    const available = await identity.boundingBox()
    if (text && status && available && text.width + status.width + 6 <= available.width) {
      expect(Math.abs(text.y + text.height / 2 - status.y - status.height / 2)).toBeLessThan(3)
    }
    if (path === 'filters') {
      await expect(
        page.locator('tbody tr').first().locator('td').first().locator('[data-active-badge]'),
      ).toBeVisible()
    }
    for (const width of [1366, 360]) {
      await page.setViewportSize({ width, height: 900 })
      for (const dark of [false, true]) {
        await page.evaluate(
          (value) => document.documentElement.classList.toggle('dark', value),
          dark,
        )
        const badges = page.locator('main [data-slot="badge"]:visible')
        await expect(badges.first()).toBeVisible()
        expect(
          await badges.evaluateAll((elements) =>
            elements.every((el) => {
              const css = getComputedStyle(el)
              return (
                css.fontSize === '12px' &&
                css.borderRadius === '8px' &&
                el.scrollWidth <= el.clientWidth + 1
              )
            }),
          ),
        ).toBe(true)
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        )
        if (['domains', 'mailboxes', 'filters', 'aliases'].includes(path)) {
          await page.screenshot({
            path: test.info().outputPath(`${width}-${dark ? 'dark' : 'light'}.png`),
          })
        }
      }
    }
  })
}

test('shared tag chips apply and remove a domain filter', async ({ page, mockApi }) => {
  await page.setViewportSize({ width: 1366, height: 900 })
  await mockApi.use('domains-60')
  await page.goto('domains?q=customer-a')
  const row = page.locator('tr[data-entry="customer-a.example"]')
  await row.locator('[aria-expanded]').first().click()
  const tag = page.getByRole('button', { name: 'Filter by tag customer-a', exact: true })
  await expect(tag.locator('[data-slot="badge"]')).toBeVisible()
  await tag.focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/tag=customer-a/)
  await page.getByRole('button', { name: 'Filters (1)', exact: true }).click()
  const remove = page.getByRole('button', { name: 'Remove tag customer-a', exact: true })
  await expect(remove.locator('[data-slot="badge"]')).toBeVisible()
  await remove.click()
  await expect(page).not.toHaveURL(/tag=customer-a/)
})

test('quarantine badges retain signed symbol scores and contain long labels', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('quarantine-mailbox-user')
  await page.goto('quarantine/11')
  await expect(page.locator('[data-item="11"]')).toBeVisible()
  await expect(page.locator('[data-symbol-score]').first()).toContainText('+')
  for (const width of [1366, 360]) {
    await page.setViewportSize({ width, height: 900 })
    const symbols = page.locator('[data-symbol] [data-slot="badge"]')
    await expect(symbols.first()).toBeVisible()
    expect(
      await symbols.evaluateAll((elements) =>
        elements.every((el) => el.scrollWidth <= el.clientWidth + 1),
      ),
    ).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
})
