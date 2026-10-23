import { expect, test } from '../fixtures/test'
import { openBulkActions } from '../fixtures/flows'

const lists = [
  ['domains', 'domains-60'],
  ['domain-templates', 'templates'],
  ['mailboxes', 'mailbox-list-tls'],
  ['mailbox-templates', 'admin-templates'],
  ['aliases', 'aliases-60'],
  ['alias-domains', 'alias-domains-admin'],
  ['resources', 'resources'],
  ['sync-jobs', 'sync-jobs-admin'],
  ['dns/dkim-keys', 'dns-admin'],
  ['identity-providers/oauth2-apps', 'oauth2-many'],
  ['filters', 'filters-many'],
  ['routing/bcc-maps', 'routing-admin-default'],
  ['administrators/admins', 'admins-three'],
  ['administrators/domain-admins', 'domain-admins-three'],
  ['quarantine', 'quarantine-mailbox-user'],
  ['operations/mail-queue', 'admin-operations'],
  ['account/temporary-aliases', 'temporary-aliases-many'],
] as const

for (const [path, scenario] of lists) {
  test(`bulk controls fit narrow phones and remain inline on desktop: ${path}`, async ({
    page,
    mockApi,
  }) => {
    await page.setViewportSize({ width: 320, height: 780 })
    await mockApi.use(scenario)
    await page.goto(path)
    await page.getByRole('button', { name: 'Select', exact: true }).click()
    await page.getByRole('checkbox').last().check()
    const bar = page.locator('[data-bulk-bar]')
    await expect(bar).not.toContainText('0 selected')
    for (const width of [320, 360, 414]) {
      await page.setViewportSize({ width, height: 780 })
      const toggle = bar.locator('[data-bulk-toggle]')
      if (await toggle.count()) {
        await expect(bar.locator('[data-bulk-actions]')).toBeHidden()
      }
      expect((await bar.boundingBox())!.height).toBeLessThan(110)
      await openBulkActions(page)
      const controls = bar.locator('button:visible, select:visible')
      for (const control of await controls.all()) {
        const box = (await control.boundingBox())!
        expect(box.width).toBeGreaterThanOrEqual(43)
        expect(box.height).toBeGreaterThanOrEqual(43)
        expect(box.x).toBeGreaterThanOrEqual(0)
        expect(box.x + box.width).toBeLessThanOrEqual(width)
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
      if (width === 360) {
        await bar.screenshot({ path: `/tmp/bulk-${path.replaceAll('/', '-')}.png` })
      }
      if (await toggle.count()) {
        await bar.locator('[data-bulk-actions] button, [data-bulk-actions] select').first().focus()
        await page.keyboard.press('Escape')
        await expect(toggle).toBeFocused()
        await expect(toggle).toHaveAttribute('aria-expanded', 'false')
      }
    }
    await page.setViewportSize({ width: 1366, height: 900 })
    await expect(bar.locator('[data-bulk-toggle]')).toHaveCount(0)
    await expect(bar.locator('[data-bulk-actions]')).toBeVisible()
    await expect(bar.getByRole('button', { name: 'Clear selection' })).toBeVisible()
    await page.setViewportSize({ width: 360, height: 780 })
    await bar.getByRole('button', { name: 'Clear selection' }).click()
    await expect(bar).toContainText('0 selected')
    if (await bar.locator('[data-bulk-toggle]').count()) {
      await expect(bar.locator('[data-bulk-toggle]')).toBeDisabled()
    }
  })
}

test('mobile direct actions preserve confirmation, focus and selected targets', async ({
  page,
  mockApi,
}) => {
  await page.setViewportSize({ width: 360, height: 780 })
  await mockApi.use('bulk-mixed')
  await page.goto('domains')
  await page.getByRole('button', { name: 'Select', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Select bulk-01.example', exact: true }).check()
  const bar = await openBulkActions(page)
  await bar.getByRole('button', { name: 'Deactivate', exact: true }).click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toContainText('bulk-01.example')
  await expect(bar.locator('[data-bulk-actions]')).toBeHidden()
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(bar.locator('[data-bulk-toggle]')).toBeFocused()
  await openBulkActions(page)
  await bar.getByRole('button', { name: 'Deactivate', exact: true }).click()
  await dialog.getByRole('button', { name: 'Deactivate', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Results' })).toContainText('1 done')
  const request = (await mockApi.requests()).find(
    (entry) => entry.operationId === 'applyDomainBulkAction',
  )!
  expect(request.body).toMatchObject({
    action: 'deactivate',
    targets: [{ id: 'bulk-01.example', version: expect.any(String) }],
  })
})

test('mobile mailbox submenus remain usable inside the action panel', async ({ page, mockApi }) => {
  await page.setViewportSize({ width: 320, height: 780 })
  await mockApi.use('mailbox-list-tls')
  await page.goto('mailboxes')
  await page.getByRole('button', { name: 'Select', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Select box001@example.org', exact: true }).check()
  const bar = await openBulkActions(page)
  await bar.locator('[data-bulk-menu="tls-outbound"]').click()
  await page.locator('[data-bulk-action="tls-outbound-activate"]').click()
  await expect(page.getByRole('region', { name: 'Results' })).toContainText('1 done')
  await expect(bar).toContainText('0 selected')
  await expect(bar.locator('[data-bulk-actions]')).toBeHidden()
  const request = (await mockApi.requests()).find(
    (entry) => entry.operationId === 'applyMailboxMailSettingsBulkAction',
  )!
  expect(request.body).toMatchObject({
    action: 'setTlsEnforcement',
    tlsEnforceOutbound: true,
    targets: [{ id: 'box001@example.org', version: expect.any(String) }],
  })
})
