// UI 011 US5 (T102): the ban list of the Fail2ban screen — legacy's lines "network (remaining) -
// [unban] [allowlist] [denylist]", "unban pending", the permanent bans, the denylist confirmation
// with the own-address warning, a ban that already ended, the stopped ban service and the empty
// list. Legacy has no search, sort or paging here (plan decision 18), and nothing refreshes on its
// own (the pending-lift refresh is not built).
import type { Page } from '@playwright/test'

import type { MockApi } from '../fixtures/mock-api'
import { expect, test } from '../fixtures/test'

async function open(page: Page, mockApi: MockApi, scenario = 'ops-fail2ban') {
  await mockApi.use(scenario)
  await page.goto('operations/fail2ban')
  await expect(page.locator('[data-ban-list]')).toBeVisible({ timeout: 15_000 })
}

const ban = (page: Page, network: string) => page.locator(`[data-ban="${network}"]`)

async function requestsOf(mockApi: MockApi, operationId: string) {
  return (await mockApi.requests()).filter((request) => request.operationId === operationId)
}

test.describe('Fail2ban bans @operations', () => {
  test("FR-063 FR-064 the screen is legacy's panel, and each active ban reads as legacy lists it", async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
    expectTouchTargets,
  }) => {
    await open(page, mockApi)
    await expect(page.getByRole('heading', { level: 1, name: 'Fail2ban parameters' })).toBeVisible()
    await expect(page.locator('[data-ban-list]')).toContainText('See a list of banned IPs below')
    await expect(ban(page, '203.0.113.0/24')).toContainText(/\(00h 2\dm \d\ds\)/)
    await expect(ban(page, '203.0.113.0/24').getByRole('button')).toHaveText([
      'unban',
      'allowlist',
      'denylist',
    ])
    await expect(ban(page, '192.0.2.77/32')).toContainText('unban pending')
    await expect(page.locator('[data-permanent-bans] li')).toHaveText([
      '198.51.100.200/32',
      '2001:db8:dead::/48',
    ])
    await expect(page.locator('[data-ban-list] a')).toHaveCount(0)
    await expectAccessible()
    await expectNoHorizontalScroll()
    await expectTouchTargets()
  })

  test('US5-AS1 FR-065 "unban" marks the ban pending at once, and it is gone once lifted', async ({
    page,
    mockApi,
  }) => {
    await open(page, mockApi)
    await ban(page, '203.0.113.0/24').getByRole('button', { name: 'unban' }).click()
    await expect(ban(page, '203.0.113.0/24')).toContainText('unban pending')
    await expect(page.locator('[data-ban-status]')).toHaveText(
      'Changes to object 203.0.113.0/24 have been saved',
    )
    expect(await requestsOf(mockApi, 'liftFail2BanBan')).toHaveLength(1)
    await page.reload()
    await expect(page.locator('[data-active-bans]')).toBeVisible()
    await expect(ban(page, '203.0.113.0/24')).toHaveCount(0)
  })

  test('US5-AS2 "allowlist" lifts the ban and puts the network on the allowlist', async ({
    page,
    mockApi,
  }) => {
    await open(page, mockApi)
    await ban(page, '2001:db8:1234::/48').getByRole('button', { name: 'allowlist' }).click()
    await expect(ban(page, '2001:db8:1234::/48')).toContainText('unban pending')
    await expect(page.locator('[data-value="allowlist"]')).toContainText('2001:db8:1234::/48')
    await expect(page.locator('[data-ban-status]')).toContainText('2001:db8:1234::/48')
  })

  test('US5-AS9 SC-007 "denylist" asks first, names the network, and makes it a permanent ban', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await open(page, mockApi)
    await ban(page, '203.0.113.0/24').getByRole('button', { name: 'denylist' }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toContainText('Denylist 203.0.113.0/24?')
    await expectAccessible()
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    expect(await requestsOf(mockApi, 'denylistFail2BanBan')).toEqual([])
    await ban(page, '203.0.113.0/24').getByRole('button', { name: 'denylist' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'denylist' }).click()
    await expect(page.locator('[data-ban-status]')).toHaveText(
      'Changes to object 203.0.113.0/24 have been saved',
    )
    await expect(
      page.locator('[data-permanent-bans] li', { hasText: '203.0.113.0/24' }),
    ).toBeVisible()
    await expect(page.locator('[data-value="denylist"]')).toContainText('203.0.113.0/24')
  })

  test("FR-064 denylisting a network that covers the caller's own address warns about it", async ({
    page,
    mockApi,
  }) => {
    await open(page, mockApi, 'ops-fail2ban-client-in-denylist')
    await ban(page, '198.51.100.0/24').getByRole('button', { name: 'denylist' }).click()
    await expect(page.getByRole('alertdialog')).toContainText(
      'This entry covers your own address 198.51.100.7. You could lock yourself out.',
    )
  })

  test('FR-065 a ban that already ended says so and the list is read again', async ({
    page,
    mockApi,
  }) => {
    await open(page, mockApi)
    await mockApi.patch({ operations: { fail2ban: { endBans: ['203.0.113.0/24'] } } })
    const before = await mockApi.mark()
    await ban(page, '203.0.113.0/24').getByRole('button', { name: 'unban' }).click()
    await expect(page.locator('[data-ban-ended]')).toHaveText('This ban has already ended.')
    await expect
      .poll(() => mockApi.countRequests('listFail2BanActiveBans', before))
      .toBeGreaterThan(0)
    await expect(ban(page, '203.0.113.0/24')).toHaveCount(0)
  })

  test('FR-073 a stopped ban service is said, and lifts stay pending', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await open(page, mockApi, 'ops-fail2ban-not-running')
    await expect(page.locator('[data-ban-service-stopped]')).toHaveText(
      'The ban service is not running. Saved changes take effect, and queued unbans are processed, once it runs.',
    )
    await expectAccessible()
    await ban(page, '203.0.113.0/24').getByRole('button', { name: 'unban' }).click()
    await page.reload()
    await expect(ban(page, '203.0.113.0/24')).toContainText('unban pending')
  })

  test('FR-074 no bans says "No active bans", and a failed read offers a retry', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
  }) => {
    await open(page, mockApi, 'ops-fail2ban-empty')
    await expect(page.locator('[data-no-bans]')).toHaveText('No active bans')
    await expectAccessible()
    await expectNoHorizontalScroll()
    await mockApi.use('ops-fail2ban', {
      operations: { inject: { listFail2BanActiveBans: { status: 503, times: 1 } } },
    })
    await page.goto('operations/fail2ban')
    await expect(page.locator('[data-ban-list]').getByRole('alert')).toBeVisible()
    await page.locator('[data-ban-list]').getByRole('button', { name: 'Try again' }).click()
    await expect(page.locator('[data-active-bans]')).toBeVisible()
  })
})

test.describe('Restart netfilter @operations', () => {
  test('FR-017 T114 "Restart netfilter" confirms with legacy\'s dialog and reports the outcome', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('admin-operations')
    await page.goto('operations/fail2ban')
    const restart = page.getByRole('button', { name: 'Restart netfilter', exact: true })
    await expect(restart).toBeVisible({ timeout: 15_000 })
    await restart.click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toContainText('netfilter-mailcow')
    await expect(dialog).toContainText('A graceful restart may take a while')
    await expectAccessible()
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(restart).toBeFocused()
    expect(await mockApi.countRequests('restartContainer')).toBe(0)
    await restart.click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Restart now' }).click()
    await expect(page.locator('[data-action-outcome]')).toContainText('OK')
    expect(await mockApi.countRequests('restartContainer')).toBe(1)
  })
})
