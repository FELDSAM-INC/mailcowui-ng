import { openBulkActions } from '../fixtures/flows'
import { expect, test } from '../fixtures/test'
import { listReady } from '../domains/helpers'

const box = (n: number) => `box${String(n).padStart(3, '0')}@example.org`

test('D6 outbound TLS applies immediately to 30 selected mailboxes with per-item versions and a missing result', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('mailbox-list-tls')
  let listed: { address: string; mailSettingsVersion: string }[] = []
  page.on('response', async (response) => {
    if (response.request().method() === 'GET' && /\/api\/v2\/mailboxes\?/.test(response.url())) {
      const body = await response.json()
      if (!listed.length) listed = body.data
    }
  })
  await page.goto('mailboxes?size=50')
  await listReady(page)
  await page.getByRole('button', { name: 'Select', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Toggle all' }).first().check()
  const bar = page.getByRole('region', { name: 'Bulk actions' })
  await expect(bar).toContainText('30 selected')
  await mockApi.patch({ mailboxes: { remove: [box(30)] } })
  await openBulkActions(page)
  await page.locator('[data-bulk-menu="tls-outbound"]').click()
  await expectAccessible()
  await page.locator('[data-bulk-action="tls-outbound-activate"]').click()
  const results = page.getByRole('region', { name: 'Results' })
  await expect(results).toContainText('29 done')
  await expect(results).toContainText('1 not found')
  await expect(page.getByRole('alertdialog')).toHaveCount(0)
  const sent = (await mockApi.requests()).find(
    (request) => request.operationId === 'applyMailboxMailSettingsBulkAction',
  )!.body
  expect(sent).toEqual({
    action: 'setTlsEnforcement',
    tlsEnforceOutbound: true,
    targets: listed.map((item) => ({ id: item.address, version: item.mailSettingsVersion })),
  })
  await expectNoHorizontalScroll()
})

test('all four TLS quick actions need no confirmation and a self-service bulk limit controls selection', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('mailbox-list-tls', { selfService: { capabilities: { bulkLimit: 2 } } })
  await page.goto('mailboxes')
  await listReady(page)
  await page.getByRole('button', { name: 'Select', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Toggle all' }).first().check()
  await expect(page.getByRole('region', { name: 'Bulk actions' })).toContainText('2 selected')
  await expect(page.getByRole('region', { name: 'Bulk actions' })).toContainText('at most 2')
  for (const direction of ['inbound', 'outbound']) {
    for (const action of ['activate', 'deactivate']) {
      await page.getByRole('checkbox', { name: `Select ${box(1)}`, exact: true }).check()
      await openBulkActions(page)
      await page.locator(`[data-bulk-menu="tls-${direction}"]`).click()
      await page.locator(`[data-bulk-action="tls-${direction}-${action}"]`).click()
      await expect(page.getByRole('region', { name: 'Results' })).toContainText('done')
      await expect(page.getByRole('alertdialog')).toHaveCount(0)
      await expect(
        page.getByRole('checkbox', { name: `Select ${box(1)}`, exact: true }),
      ).not.toBeChecked()
    }
  }
  expect(await mockApi.countRequests('applyMailboxMailSettingsBulkAction')).toBe(4)
})
