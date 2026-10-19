// UI 011 US1 (T047): the dashboard as legacy's "System & Containers" tab, with the decisions of
// plan.md "Decisions at implementation": the host card in legacy order, CPU and memory with live
// charts, the disk usage, one card per container with legacy's Running or Stopped, the expanded
// resource charts, the container's own address, and one section's failure hiding no other.
import { expect, test } from '../fixtures/test'
import { card, dashboardReady, expand, openDashboard, requestsOf } from './dashboard-helpers'

test.describe('dashboard @operations', () => {
  test('US1-AS1 FR-004 FR-007 the host card shows the host, its time, uptime and disk usage in binary units', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
    expectTouchTargets,
  }) => {
    await mockApi.use('admin-operations')
    await openDashboard(page)
    await dashboardReady(page)
    const host = page.locator('[data-host-section]')
    await expect(host.getByRole('heading', { level: 2 })).toHaveText('Example Mail')
    await expect(host.locator('dt')).toHaveText([
      'Hostname',
      'Architecture',
      'IPs',
      'Version',
      'System Time',
      'Timezone',
      'Uptime',
      'Disk usage',
    ])
    await expect(host.locator('[data-hostname]')).toHaveText('mail.example.org')
    await expect(host.locator('[data-architecture]')).toHaveText('x86_64')
    await expect(host.locator('[data-time-zone]')).toHaveText('Europe/Prague')
    await expect(host.locator('[data-uptime]')).toContainText('3 days')
    await expect(host.locator('[data-host-time] time')).toHaveAttribute('datetime', /Z$/)
    await expect(host.locator('[data-mail-storage]')).toContainText('/dev/sda1')
    await expect(host.locator('[data-mail-storage]')).toContainText('42 GiB / 100 GiB (42%)')
    await expect(host.getByRole('progressbar', { name: 'Disk usage' })).toHaveAttribute(
      'aria-valuenow',
      '42',
    )
    await expect(host.locator('[data-cpu]')).toHaveText(/^4 Cores @ \d+%$/)
    await expect(host.locator('[data-memory]')).toHaveText(/^8 GiB @ \d+%$/)
    await expect(host.locator('[data-version]')).toContainText('2026-09a')
    await expectAccessible()
    await expectNoHorizontalScroll()
    await expectTouchTargets()
  })

  test('US1-AS2 US1-AS4 FR-008 each container is a card with its name, image, start time and Running or Stopped', async ({
    page,
    mockApi,
    expectNoHorizontalScroll,
  }) => {
    await mockApi.use('admin-operations')
    await openDashboard(page)
    await dashboardReady(page)
    const list = page.locator('[data-containers]')
    await expect(list.getByRole('heading', { level: 2 })).toHaveText('Container information')
    await expect(list.getByRole('listitem')).toHaveCount(20)
    const sogo = card(page, 'sogo-mailcow')
    await expect(sogo.getByRole('heading', { level: 3 })).toHaveText('sogo-mailcow')
    await expect(sogo).toContainText('(ghcr.io/mailcow/sogo:1.133)')
    await expect(sogo.locator('[data-started]')).toContainText('Started on')
    await expect(sogo.locator('[data-state="stopped"]')).toHaveText('Stopped')
    await expect(sogo.locator('[data-state="stopped"] svg')).toBeVisible()
    await expect(card(page, 'dovecot-mailcow').locator('[data-state="running"]')).toHaveText(
      'Running',
    )
    await expectNoHorizontalScroll()
  })

  test('US1-AS7 FR-006 an unmeasured mail storage says "Unavailable" and shows no zeros', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('ops-storage-unavailable')
    await openDashboard(page)
    const storage = page.locator('[data-mail-storage]')
    await expect(storage).toHaveText('Unavailable')
    await expect(storage).not.toContainText('0 B')
    await expectAccessible()
  })

  test('US1-AS8 a domain administrator gets "not available for your role"', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('domain-admin-operations')
    await page.goto('operations/dashboard')
    await expect(page.getByRole('heading', { name: 'No access' })).toBeVisible()
    expect(await requestsOf(mockApi, 'getHostOverview')).toEqual([])
  })

  test('FR-005 FR-010 the charts follow the figures; an expanded card charts its disk and network rates', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
  }) => {
    await page.clock.install()
    await mockApi.use('admin-operations')
    await openDashboard(page)
    await dashboardReady(page)
    const host = page.locator('[data-host-section]')
    await expect(host.locator('[data-live-chart]')).toHaveCount(2)
    await expect(host.locator('[data-live-chart]').first()).toContainText('Loading...')
    await page.clock.runFor(5_500)
    await expect(host.getByRole('img', { name: 'CPU' })).toBeVisible()
    await host.getByRole('button', { name: 'Show the values as a table' }).first().click()
    await expect(host.getByRole('table').first().locator('thead th')).toHaveText(['Time', 'CPU'])

    const resourceResponse = () =>
      page.waitForResponse((response) =>
        response.url().endsWith('/containers/dovecot-mailcow/resource-usage'),
      )
    const initialResource = resourceResponse()
    const dovecot = await expand(page, 'dovecot-mailcow')
    await (await initialResource).finished()
    await expect(dovecot.locator('figcaption')).toHaveText(['Disk I/O', 'Net I/O'])
    await expect(dovecot.locator('[data-live-chart]').first()).toContainText('Loading...')
    // Advancing again while a fetch is in flight skips the next poll: TanStack schedules it
    // after that response. The first sample has no rates, so wait for two completed polls.
    for (let sample = 0; sample < 2; sample++) {
      const response = resourceResponse()
      await page.clock.runFor(5_500)
      await (await response).finished()
      await page.clock.runFor(1)
    }
    await expect(dovecot.getByRole('img', { name: 'Disk I/O' })).toBeVisible()
    await expect(dovecot.locator('[data-legend]').first()).toContainText('Read')
    await expect(dovecot.locator('[data-current]').first()).toContainText('/s')
    await expectAccessible()
    await expectNoHorizontalScroll()

    const sogo = await expand(page, 'sogo-mailcow')
    await expect(sogo.locator('[data-no-resource-data]')).toHaveText(
      'No resource data is available while the container is not running.',
    )
    await dovecot.locator('[data-expand]').click()
    await expect(dovecot.locator('[data-container-details]')).toHaveCount(0)
    await expand(page, 'dovecot-mailcow')
    await expect(dovecot.locator('[data-live-chart]').first()).toContainText('Loading...')
  })

  test("FR-002 a container's address opens its card; collapsing returns to the dashboard; an unknown name is not found", async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('admin-operations')
    await openDashboard(page, 'operations/containers/sogo-mailcow')
    const sogo = card(page, 'sogo-mailcow')
    await expect(sogo.locator('[data-container-details]')).toBeVisible()
    await expect(sogo.locator('[data-expand]')).toBeFocused()
    await sogo.locator('[data-expand]').click()
    await expect(page).toHaveURL(/\/ng\/operations\/dashboard$/)

    await page.goto('operations/containers/missing-mailcow')
    await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
    await page.getByRole('link', { name: 'System & Containers' }).last().click()
    await expect(page).toHaveURL(/\/ng\/operations\/dashboard$/)
    await expectAccessible()
  })

  test('FR-025 Edge: container service unavailable: each section fails on its own, the version still shows', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
  }) => {
    await mockApi.use('ops-container-service-down')
    await openDashboard(page)
    await expect(page.locator('[data-section-error]')).toHaveCount(3)
    await expect(page.locator('[data-version]')).toContainText('2026-09a')
    await expect(page.locator('[data-containers] [data-section-error]')).toContainText(
      'This section could not be loaded.',
    )
    await expectAccessible()
    await expectNoHorizontalScroll()
    await mockApi.patch({
      operations: {
        inject: {
          getHostOverview: null,
          getMailStorageUsage: null,
          listContainers: null,
          getContainerResourceUsage: null,
        },
      },
    })
    await page.locator('[data-containers]').getByRole('button', { name: 'Try again' }).click()
    await expect(page.locator('[data-containers] li').first()).toBeVisible()
  })

  test('Edge: a container removed meanwhile leaves the list', async ({ page, mockApi }) => {
    await page.clock.install()
    await mockApi.use('admin-operations')
    await openDashboard(page)
    await dashboardReady(page)
    await expect(card(page, 'olefy-mailcow')).toBeVisible()
    await mockApi.patch({ operations: { dashboard: { containers: { 'olefy-mailcow': null } } } })
    await page.clock.runFor(5_500)
    await expect(card(page, 'olefy-mailcow')).toHaveCount(0)
  })

  test('FR-003 a refused container list shows its own error and the identity is read again', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('admin-operations', {
      operations: { inject: { listContainers: { status: 403, problemType: 'forbidden' } } },
    })
    const before = await mockApi.mark()
    await openDashboard(page)
    await expect(page.locator('[data-containers] [data-section-error]')).toBeVisible()
    await expect(page.locator('[data-hostname]')).toBeVisible()
    await expect.poll(() => mockApi.countRequests('getIdentity', before)).toBeGreaterThan(1)
  })
})
