// UI 011 US1 live updates (T048): polling at the capabilities' interval while the dashboard is
// visible, nothing while hidden, paused or inactive, immediate reads on return and resume, the
// "updating failed" notice that keeps the last values, the stopped container announced once, the
// mail storage at its own interval, the version once per visit, and the notice when the
// capabilities cannot be read. (Freshness ages are not built: plan decision 12.)
import { setPageVisibility } from '../fixtures/visibility'
import { expect, test } from '../fixtures/test'
import { card, dashboardReady, openDashboard } from './dashboard-helpers'

const LIVE = [
  'getHostOverview',
  'listContainers',
  'getMailStorageUsage',
  'getContainerResourceUsage',
]

test.describe('dashboard live updates @operations', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install()
  })

  test('US1-AS3 FR-018 the host figures and container states are read again every 5 s', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('admin-operations')
    await openDashboard(page)
    await dashboardReady(page)
    const first = await page.locator('[data-cpu]').textContent()
    const mark = await mockApi.mark()
    await page.clock.runFor(5_500)
    await expect.poll(() => mockApi.countRequests('getHostOverview', mark)).toBe(1)
    await expect.poll(() => mockApi.countRequests('listContainers', mark)).toBe(1)
    await expect(page.locator('[data-cpu]')).not.toHaveText(first ?? '')
    expect(await mockApi.countRequests('getMailStorageUsage', mark)).toBe(0)
    await page.clock.runFor(60_000)
    await expect.poll(() => mockApi.countRequests('getMailStorageUsage', mark)).toBe(1)
    expect(await mockApi.countRequests('getInstallationVersion')).toBe(1)
    expect(await mockApi.countRequests('getUpdateStatus')).toBe(1)
  })

  test('US1-AS5 SC-004 FR-019 nothing is read while the page is hidden; showing it reads at once', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('admin-operations')
    await openDashboard(page)
    await dashboardReady(page)
    await setPageVisibility(page, 'hidden')
    const mark = await mockApi.mark()
    await page.clock.runFor(60_000)
    for (const operationId of LIVE) expect(await mockApi.countRequests(operationId, mark)).toBe(0)
    await setPageVisibility(page, 'visible')
    await page.clock.runFor(500)
    await expect.poll(() => mockApi.countRequests('getHostOverview', mark)).toBe(1)
    await expect.poll(() => mockApi.countRequests('listContainers', mark)).toBe(1)
    await page.clock.runFor(5_500)
    await expect.poll(() => mockApi.countRequests('getHostOverview', mark)).toBe(2)

    await page.locator('header a[href="/ng/"]').click()
    await expect(page).toHaveURL(/\/ng\/$/)
    const left = await mockApi.mark()
    await page.clock.runFor(30_000)
    expect(await mockApi.countRequests('getHostOverview', left)).toBe(0)
  })

  test('US1-AS6 FR-023 a failed update keeps the last values, says so, and keeps reading', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('admin-operations')
    await openDashboard(page)
    await dashboardReady(page)
    await mockApi.patch({
      operations: {
        inject: { getHostOverview: { status: 503, problemType: 'temporary-failure' } },
      },
    })
    const mark = await mockApi.mark()
    await page.clock.runFor(5_500)
    await expect(page.locator('[data-live-failed]')).toHaveText(
      'Updating failed. The values shown may be out of date.',
    )
    await expect(page.locator('[data-hostname]')).toHaveText('mail.example.org')
    await page.clock.runFor(5_500)
    await expect.poll(() => mockApi.countRequests('getHostOverview', mark)).toBe(2)
    await mockApi.patch({ operations: { inject: { getHostOverview: null } } })
    await page.clock.runFor(5_500)
    await expect(page.locator('[data-live-failed]')).toHaveCount(0)
  })

  test('US1-AS9 FR-020 pausing stops the reads, the manual refresh still works, resuming reads at once', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('admin-operations')
    await openDashboard(page)
    await dashboardReady(page)
    await page.getByRole('button', { name: 'Pause live updates' }).click()
    await expect(page.locator('[data-live-notice]')).toHaveText(/^Live updates paused since .+\.$/)
    await expectAccessible()
    const mark = await mockApi.mark()
    await page.clock.runFor(30_000)
    expect(await mockApi.countRequests('getHostOverview', mark)).toBe(0)
    await page.getByRole('button', { name: 'Refresh', exact: true }).click()
    await expect.poll(() => mockApi.countRequests('getHostOverview', mark)).toBe(1)
    await page.getByRole('button', { name: 'Resume live updates' }).click()
    await expect.poll(() => mockApi.countRequests('getHostOverview', mark)).toBe(2)
    await page.clock.runFor(5_500)
    await expect.poll(() => mockApi.countRequests('getHostOverview', mark)).toBe(3)
  })

  test('US1-AS9 FR-021 without interaction for the session idle timeout, updates pause with a notice', async ({
    page,
    mockApi,
  }) => {
    // An idle timeout of 5 minutes, below the 15-minute limit (the session warning comes 2 minutes
    // before the end, which polling keeps away until updates pause).
    await mockApi.use('admin-operations', { idleTimeout: 300 })
    await openDashboard(page)
    await dashboardReady(page)
    await page.clock.runFor(301_000)
    await expect(page.locator('[data-live-notice]')).toHaveText(
      'Live updates were paused because there was no activity.',
    )
    const mark = await mockApi.mark()
    await page.clock.runFor(30_000)
    expect(await mockApi.countRequests('getHostOverview', mark)).toBe(0)
    await page.getByRole('button', { name: 'Resume live updates' }).click()
    await expect.poll(() => mockApi.countRequests('getHostOverview', mark)).toBe(1)
  })

  test('FR-024 a container that stops while shown is announced once', async ({ page, mockApi }) => {
    await mockApi.use('admin-operations')
    await openDashboard(page)
    await dashboardReady(page)
    await mockApi.patch({
      operations: {
        dashboard: { containers: { 'dovecot-mailcow': { running: false, state: 'exited' } } },
      },
    })
    await page.clock.runFor(5_500)
    await expect(card(page, 'dovecot-mailcow').locator('[data-state="stopped"]')).toBeVisible()
    await page.clock.runFor(100)
    await expect(page.locator('[data-live="polite"]')).toHaveText(
      'dovecot-mailcow is no longer running.',
    )
  })

  test('FR-018 without capabilities the figures load once, nothing polls, and a notice offers a retry', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('ops-capabilities-unavailable')
    await openDashboard(page)
    await dashboardReady(page)
    await expect(page.locator('[data-live-notice]')).toHaveText(
      'Live updates are off because the monitoring settings could not be read.',
    )
    await expectAccessible()
    const mark = await mockApi.mark()
    await page.clock.runFor(30_000)
    expect(await mockApi.countRequests('getHostOverview', mark)).toBe(0)
    await mockApi.patch({ operations: { inject: { getMonitoringCapabilities: null } } })
    await page.locator('[data-live-updates]').getByRole('button', { name: 'Try again' }).click()
    await expect(page.getByRole('button', { name: 'Pause live updates' })).toBeVisible()
    await page.clock.runFor(5_500)
    await expect.poll(() => mockApi.countRequests('getHostOverview', mark)).toBeGreaterThan(0)
  })

  test('Edge: the session ends while the dashboard updates: reading stops and sign-in shows', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('admin-operations')
    await openDashboard(page)
    await dashboardReady(page)
    await mockApi.patch({ expireSession: true })
    await page.clock.runFor(5_500)
    await expect(page).toHaveURL(/sign-in/)
    const mark = await mockApi.mark()
    await page.clock.runFor(30_000)
    expect(await mockApi.countRequests('getHostOverview', mark)).toBe(0)
  })
})
