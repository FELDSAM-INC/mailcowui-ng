import { openBulkActions } from '../fixtures/flows'
import { clickRowAction } from '../fixtures/row-actions'
// UI 009 US8, forwarding hosts (T103): the classic columns with the spam filter in text, the
// source filter, legacy's add form with every resulting address reported, names that do not
// resolve and DNS outages, legacy's quick actions and deletion.
import { expect, test } from '../fixtures/test'
import { entry, entryIds, listReady, polite } from './helpers'

test.describe('forwarding hosts', () => {
  test('US8-AS1 FR-059 the classic columns and the hint; US8-AS4 a source filters the list', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
    expectTouchTargets,
  }) => {
    await mockApi.use('routing-admin-default')
    await page.goto('routing/forwarding-hosts')
    await expect(page.getByRole('heading', { level: 1, name: 'Forwarding Hosts' })).toBeVisible()
    await listReady(page)
    expect(await entryIds(page)).toEqual([
      '192.0.2.0/24',
      '198.51.100.7',
      '203.0.113.9',
      '2001:0db8:0000:0000:0000:0000:0000:0001',
    ])
    await expect(entry(page, '192.0.2.0/24')).toContainText('✕')
    await expect(entry(page, '198.51.100.7')).toContainText('✓')
    await expect(page.locator('[data-screen-intro]')).toContainText('unconditionally accepted')
    await expectAccessible()
    await expectTouchTargets()
    await expectNoHorizontalScroll()
    await entry(page, '198.51.100.7').getByRole('button', { name: 'forwarder.example' }).click()
    await expect(page).toHaveURL(/source=forwarder.example/)
    await listReady(page)
    expect(await entryIds(page)).toEqual(['198.51.100.7'])
    await expect(page.getByRole('link', { name: 'History of this source' })).toBeVisible()
  })

  test('FR-060 FR-061 US8-AS2 adding a name reports every address as added or updated', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('routing-admin-default')
    await page.goto('routing/forwarding-hosts/new')
    await expect(page.getByRole('heading', { level: 1, name: 'Add forwarding host' })).toBeVisible()
    await expect(page.getByText('You can either specify IPv4/IPv6 addresses')).toBeVisible()
    await expect(page.getByLabel('Spam filter')).toHaveValue('1')
    await expectAccessible()
    await page.getByLabel('Host').fill('forwarder.example')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page).toHaveURL(/routing\/forwarding-hosts\?source=forwarder.example/)
    const results = page.locator('[data-forwarding-results]')
    await expect(results).toContainText('Forwarding host 198.51.100.8 has been added')
    await expect(results).toContainText('198.51.100.7')
    await listReady(page)
    expect(await entryIds(page)).toEqual(['198.51.100.7', '198.51.100.8'])
  })

  test('Edge: a network shows its stored form', async ({ page, mockApi }) => {
    await mockApi.use('routing-admin-default')
    await page.goto('routing/forwarding-hosts/new')
    await page.getByLabel('Host').fill('203.0.113.77/24')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.locator('[data-forwarding-results]')).toContainText(
      'Forwarding host 203.0.113.0/24 has been added',
    )
  })

  test('US8-AS3 FR-062 a name without address is a field error, a DNS outage offers a retry', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('routing-admin-default')
    await page.goto('routing/forwarding-hosts/new')
    await page.getByLabel('Host').fill('nothing.example')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.locator('#fwdhost-add-host-error')).toContainText(
      'Invalid host specified: nothing.example',
    )
    await page.getByLabel('Host').fill('dns-down.example')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.getByText('a server component is temporarily unavailable')).toBeVisible()
    // The retry is offered once the API's Retry-After (5 s in the mock) has passed.
    const retry = page.getByRole('button', { name: 'Try again' })
    await expect(retry).toHaveCount(0)
    await expect(retry).toBeVisible({ timeout: 10_000 })
  })

  test('FR-063 legacy’s quick actions and deletion', async ({ page, mockApi }) => {
    await mockApi.use('routing-admin-default')
    await page.goto('routing/forwarding-hosts')
    await listReady(page)
    await page.getByRole('button', { name: 'Select', exact: true }).click()
    await entry(page, '192.0.2.0/24').getByRole('checkbox').check()
    await (await openBulkActions(page)).getByRole('button', { name: 'Enable spam filter' }).click()
    await expect(page.getByRole('region', { name: 'Results' })).toContainText(
      'Changes to object 192.0.2.0/24 have been saved',
    )
    await page
      .getByRole('region', { name: 'Results' })
      .getByRole('button', { name: 'Close' })
      .click()
    await page.getByRole('button', { name: 'Done selecting' }).click()
    await clickRowAction(page, entry(page, '203.0.113.9'), 'Remove: 203.0.113.9')
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete now' }).click()
    await expect(polite(page)).toContainText('Forwarding host 203.0.113.9 has been removed')
  })
})
