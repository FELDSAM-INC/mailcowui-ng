// UI 011 US2 (T062): start, stop and restart as the API allows, with legacy's restart dialog (no
// role warnings: plan decision 16), a stop confirmation, the progress with the elapsed time, every
// outcome including "Outcome unknown", and outcomes that survive leaving the dashboard.
import { expect, test } from '../fixtures/test'
import { card, dashboardReady, expand, openDashboard, requestsOf } from './dashboard-helpers'

test.describe('container actions @operations', () => {
  test('US2-AS1 SC-001 restarting SOGo takes two interactions after opening its card', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
    expectTouchTargets,
  }) => {
    await mockApi.use('ops-container-actions')
    await openDashboard(page)
    await dashboardReady(page)
    const sogo = await expand(page, 'sogo-mailcow')
    await sogo.getByRole('button', { name: 'Restart', exact: true }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog.getByRole('heading')).toHaveText('Restart container (sogo-mailcow)')
    await expect(dialog).toContainText('A graceful restart may take a while to complete')
    await expectAccessible()
    await dialog.getByRole('button', { name: 'Restart now' }).click()
    const progress = sogo.locator('[data-action-progress]')
    await expect(progress).toContainText('Restarting container, this may take a while')
    await expect(progress).toContainText(/\(\d+ s\)/)
    await expect(sogo.getByRole('button', { name: 'Start', exact: true })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    await expectNoHorizontalScroll()
    await expectTouchTargets()
    await expect(sogo.locator('[data-action-outcome]')).toHaveText('OK', { timeout: 15_000 })
    await expect(sogo.locator('[data-state="running"]')).toBeVisible()
    await expect(page.locator('[data-live="polite"]')).toHaveText('sogo-mailcow: OK')
    expect(await requestsOf(mockApi, 'restartContainer')).toHaveLength(1)
  })

  test('US2-AS2 US2-AS3 FR-011 a protected container cannot be stopped; the API container offers neither', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('ops-container-actions')
    await openDashboard(page)
    await dashboardReady(page)
    const mysql = await expand(page, 'mysql-mailcow')
    await expect(mysql.locator('[data-action]')).toHaveText(['Restart'])
    const api = await expand(page, 'api-mailcow')
    await expect(api.locator('[data-action]')).toHaveCount(0)
    const dovecot = await expand(page, 'dovecot-mailcow')
    await expect(dovecot.locator('[data-action]')).toHaveText(['Stop', 'Restart'])
  })

  test('US2-AS4 SC-006 a timeout says "Outcome unknown", reads the container once and sends once', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('ops-container-actions')
    await openDashboard(page)
    await dashboardReady(page)
    const olefy = await expand(page, 'olefy-mailcow')
    await olefy.getByRole('button', { name: 'Restart', exact: true }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Restart now' }).click()
    const outcome = olefy.locator('[data-action-outcome]')
    await expect(outcome).toContainText('Outcome unknown')
    await expect(outcome).toContainText('It is unknown whether the action was completed')
    await expect.poll(async () => (await requestsOf(mockApi, 'getContainer')).length).toBe(1)
    expect(await requestsOf(mockApi, 'restartContainer')).toHaveLength(1)
    await expect(olefy.getByRole('button', { name: 'Restart', exact: true })).not.toHaveAttribute(
      'aria-disabled',
      'true',
    )
    await expectAccessible()
  })

  test('US2-AS5 US2-AS6 Start asks nothing; a container already running says so', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('admin-operations')
    await openDashboard(page)
    await dashboardReady(page)
    await page.getByRole('button', { name: 'Pause live updates' }).click()
    const sogo = await expand(page, 'sogo-mailcow')
    await mockApi.patch({
      operations: {
        dashboard: { containers: { 'sogo-mailcow': { running: true, state: 'running' } } },
      },
    })
    await sogo.getByRole('button', { name: 'Start', exact: true }).click()
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    await expect(sogo.locator('[data-action-outcome]')).toHaveText('Already running')

    const clamd = await expand(page, 'clamd-mailcow')
    await clamd.getByRole('button', { name: 'Stop', exact: true }).click()
    await expect(page.getByRole('alertdialog').getByRole('heading')).toHaveText(
      'Stop container (clamd-mailcow)',
    )
    await page.getByRole('alertdialog').getByRole('button', { name: 'Stop now' }).click()
    await expect(clamd.locator('[data-action-outcome]')).toHaveText('OK')
    await expect(clamd.locator('[data-state="stopped"]')).toBeVisible()
    await clamd.getByRole('button', { name: 'Start', exact: true }).click()
    await expect(clamd.locator('[data-state="running"]')).toBeVisible()
  })

  test("US2-AS7 a refused stop shows legacy's error with the service's message", async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('ops-container-actions')
    await openDashboard(page)
    await dashboardReady(page)
    const memcached = await expand(page, 'memcached-mailcow')
    await memcached.getByRole('button', { name: 'Stop', exact: true }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Stop now' }).click()
    await expect(memcached.locator('[data-action-outcome]')).toHaveText(
      'Error: Cannot kill container: memcached-mailcow is busy',
    )
  })

  test('US2-AS8 Cancel and Escape send nothing and return the focus to the action', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('ops-container-actions')
    await openDashboard(page)
    await dashboardReady(page)
    const dovecot = await expand(page, 'dovecot-mailcow')
    const restart = dovecot.getByRole('button', { name: 'Restart', exact: true })
    await restart.click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click()
    await expect(restart).toBeFocused()
    await restart.click()
    await expect(page.getByRole('alertdialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    await expect(restart).toBeFocused()
    expect(await requestsOf(mockApi, 'restartContainer')).toEqual([])
  })

  test('FR-013 FR-016 other containers stay usable while one runs; a missing audit record and a removed container are reported', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('ops-container-actions')
    await openDashboard(page)
    await dashboardReady(page)
    const sogo = await expand(page, 'sogo-mailcow')
    await sogo.getByRole('button', { name: 'Restart', exact: true }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Restart now' }).click()
    await expect(sogo.locator('[data-action-progress]')).toBeVisible()
    const redis = await expand(page, 'redis-mailcow')
    await redis.getByRole('button', { name: 'Restart', exact: true }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Restart now' }).click()
    await expect(redis.locator('[data-not-recorded]')).toHaveText(
      'The action was carried out, but no audit record was written.',
    )
    const acme = await expand(page, 'acme-mailcow')
    await acme.getByRole('button', { name: 'Restart', exact: true }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Restart now' }).click()
    await expect(page.locator('[data-live="assertive"]')).toHaveText(
      'acme-mailcow: This item could not be found.',
    )
    await expect(card(page, 'acme-mailcow')).toHaveCount(0)
    await expect(sogo.locator('[data-action-outcome]')).toHaveText('OK', { timeout: 15_000 })
  })

  test('FR-016 a temporary failure says nothing was changed', async ({ page, mockApi }) => {
    await mockApi.use('ops-container-actions', {
      operations: {
        inject: { restartContainer: { status: 503, problemType: 'temporary-failure', times: 1 } },
      },
    })
    await openDashboard(page)
    await dashboardReady(page)
    const dovecot = await expand(page, 'dovecot-mailcow')
    await dovecot.getByRole('button', { name: 'Restart', exact: true }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Restart now' }).click()
    await expect(dovecot.locator('[data-action-outcome]')).toContainText('Nothing was changed')
  })

  test('Edge: restart of the reverse proxy: a dropped connection is "Outcome unknown"', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('ops-container-actions')
    await openDashboard(page)
    await dashboardReady(page)
    await page.route('**/api/v2/containers/nginx-mailcow/restart', (route) => route.abort())
    const nginx = await expand(page, 'nginx-mailcow')
    await nginx.getByRole('button', { name: 'Restart', exact: true }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Restart now' }).click()
    await expect(nginx.locator('[data-action-outcome]')).toContainText('Outcome unknown')
    await expect.poll(async () => (await requestsOf(mockApi, 'getContainer')).length).toBe(1)
    await expect(nginx.locator('[data-state="running"]')).toBeVisible()
  })

  test('Edge: leaving the dashboard: the outcome shows as a status message until dismissed', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('ops-container-actions')
    await openDashboard(page)
    await dashboardReady(page)
    const sogo = await expand(page, 'sogo-mailcow')
    await sogo.getByRole('button', { name: 'Restart', exact: true }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Restart now' }).click()
    await page.locator('header a[href="/ng/"]').click()
    await expect(page).toHaveURL(/\/ng\/$/)
    const message = page.locator('[data-status-message]')
    await expect(message).toHaveText('sogo-mailcow: OK', { timeout: 15_000 })
    await page.waitForTimeout(1000)
    await expect(message).toBeVisible()
    await message.getByRole('button', { name: 'Close' }).click()
    await expect(message).toHaveCount(0)
  })

  test('Edge: transitional states show legacy Running and the actions the API reports', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('ops-container-actions')
    await openDashboard(page)
    await dashboardReady(page)
    for (const name of ['watchdog-mailcow', 'ofelia-mailcow']) {
      const target = await expand(page, name)
      await expect(target.locator('[data-state="running"]')).toHaveText('Running')
      await expect(target.locator('[data-action]')).toHaveText(['Stop', 'Restart'])
    }
  })
})
