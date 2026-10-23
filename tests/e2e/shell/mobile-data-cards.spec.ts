import { expect, test } from '../fixtures/test'
import { chooseTheme } from '../fixtures/flows'

// Each mobile implementation behind a data table is exercised, including the shared routing
// renderer and both account roles. Small two-column value tables remain tables on mobile.
const lists = [
  ['domains', 'domains-60'],
  ['domain-templates', 'templates'],
  ['mailboxes', 'admin-mailboxes-30'],
  ['mailbox-templates', 'admin-templates'],
  ['aliases', 'aliases-60'],
  ['alias-domains', 'alias-domains-admin'],
  ['resources', 'resources'],
  ['filters', 'filters-many'],
  ['sync-jobs', 'sync-jobs-admin'],
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
  ['identity-providers/oauth2-apps', 'oauth2-many'],
  ['dns/dkim-keys', 'dns-admin'],
  ['dns/mta-sts-policies', 'dns-mta-sts'],
  ['quarantine', 'quarantine-mailbox-user'],
  ['operations/mail-queue', 'admin-operations'],
  ['operations/logs/postfix', 'admin-operations'],
  ['operations/logs/autodiscover', 'admin-operations'],
  ['operations/logs/rspamd', 'ops-rspamd'],
  ['audit-log', 'audit-records'],
  ['account/app-passwords', 'account-mailbox'],
  ['account/temporary-aliases', 'temporary-aliases-many'],
  ['account/recent-logins', 'account-recent-logins'],
  ['passkeys', 'user-with-passkeys'],
  ['spam-filter', 'policy-user'],
  ['system/rspamd-rules', 'rspamd-rules-30'],
  ['system/customize/app-links', 'app-links-three'],
  ['system/mass-mail/jobs', 'mass-mail-completed'],
] as const

for (const [path, scenario] of lists) {
  test(`mobile rows share the card layout: ${path}`, async ({ page, mockApi }) => {
    await page.setViewportSize({ width: 360, height: 780 })
    await mockApi.use(scenario)
    await page.goto(path)
    const card = page.locator('main [data-card]').first()
    await expect(card).toBeVisible()
    await expect(card.locator('[data-card-header] h3')).not.toBeEmpty()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const actions = card.locator('[data-row-action-trigger]')
    if (await actions.count()) {
      await expect(card.locator('[data-card-header] [data-row-action-trigger]')).toHaveCount(1)
      expect((await actions.boundingBox())!.height).toBeGreaterThanOrEqual(44)
      await actions.click()
      await expect(page.getByRole('menu')).toBeVisible()
      await expect(page.getByRole('menuitem', { name: /History/i })).toHaveCount(0)
      await page.keyboard.press('Escape')
      await expect(actions).toBeFocused()
    }
    const expand = card.locator('[data-card-expand]')
    if (await expand.count()) {
      await expect(expand).toHaveAttribute('aria-expanded', 'false')
      await expect(card.locator('[data-card-details]')).toHaveCount(0)
      await expand.click()
      await expect(card.locator('[data-card-details]')).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      )
      await card.screenshot({
        path: test.info().outputPath('card-details.png'),
        animations: 'disabled',
      })
      await expand.click()
      await expect(card.locator('[data-card-details]')).toHaveCount(0)
    }
    await card.screenshot({
      path: test.info().outputPath('card-light.png'),
      animations: 'disabled',
    })
    if (['domains', 'mailboxes', 'aliases', 'filters'].includes(path)) {
      await chooseTheme(page, 'Dark')
      await card.screenshot({
        path: test.info().outputPath('card-dark.png'),
        animations: 'disabled',
      })
    }
  })
}

test('mailbox actions and selection stay in the header and full column details remain available', async ({
  page,
  mockApi,
}) => {
  await page.setViewportSize({ width: 360, height: 780 })
  await mockApi.use('admin-mailboxes-30')
  await page.goto('mailboxes?q=anna@')
  const row = page.locator('[data-card][data-entry="anna@a.example"]')
  await expect(row).toBeVisible()
  expect((await row.boundingBox())!.height).toBeLessThan(370)
  await expect(row).toContainText('1,200')
  await expect(row.locator('[data-card-actions]')).toBeVisible()
  await row.locator('[data-card-expand]').click()
  await expect(row.locator('[data-entry-details]')).toContainText('Last mail login')
  await expect(row.locator('[data-entry-details]')).toContainText('SMTP')
  await page.getByRole('button', { name: 'Select', exact: true }).click()
  const checkbox = row.locator('[data-card-header]').getByRole('checkbox')
  await checkbox.check()
  await expect(checkbox).toBeChecked()
  await expect(page.getByRole('region', { name: 'Bulk actions' })).toContainText('1 selected')
})

for (const [path, scenario] of [
  ['filters', 'filters-many'],
  ['system/rspamd-rules', 'rspamd-rules-30'],
  ['quarantine', 'quarantine-mailbox-user'],
  ['account/app-passwords', 'account-mailbox'],
] as const) {
  test(`mobile row removal still confirms and restores focus: ${path}`, async ({
    page,
    mockApi,
  }) => {
    await page.setViewportSize({ width: 360, height: 780 })
    await mockApi.use(scenario)
    await page.goto(path)
    const row = page.locator('main [data-card]').first()
    const trigger = row.locator('[data-row-action-trigger]')
    await trigger.click()
    await page.getByRole('menuitem', { name: /^Remove/ }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await expect(trigger).toBeFocused()
    await expect(row).toBeVisible()
  })
}

test('DNS checks and editable Fail2Ban rules fit the same mobile cards', async ({
  page,
  mockApi,
}) => {
  await page.setViewportSize({ width: 360, height: 780 })
  await mockApi.use('dns-diagnostics-all-statuses')
  await page.goto('dns/diagnostics/example.org')
  await expect(page.locator('[data-card][data-check]').first()).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page
    .locator('[data-card][data-check]')
    .first()
    .screenshot({ path: test.info().outputPath('dns-card.png') })
  await mockApi.use('ops-fail2ban')
  await page.goto('operations/fail2ban')
  await page.getByRole('button', { name: 'Regex filters', exact: true }).click()
  const rows = page.locator('[data-card][data-rule]')
  await expect(rows).toHaveCount(8)
  const input = rows.first().getByRole('textbox')
  expect((await input.boundingBox())!.width).toBeGreaterThan(250)
  await page.getByRole('button', { name: 'Add row', exact: true }).click()
  await expect(rows).toHaveCount(9)
  await rows.last().getByRole('textbox').fill('^test-pattern$')
  await rows
    .last()
    .locator('[data-card-actions]')
    .getByRole('button', { name: 'Remove row' })
    .click()
  await expect(rows).toHaveCount(8)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await rows.first().screenshot({ path: test.info().outputPath('fail2ban-card.png') })
})
