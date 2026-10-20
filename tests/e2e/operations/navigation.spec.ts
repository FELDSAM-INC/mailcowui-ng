// UI 011 FR-001 (T028): the "System" group of the administrator navigation, its four screens, and
// the "not available for your role" state for other roles without any request of this feature.
import { expect, test } from '../fixtures/test'

const SCREENS = [
  ['System & Containers', 'operations/dashboard'],
  ['Logs', 'operations/logs/postfix'],
  ['Queue Manager', 'operations/mail-queue'],
  ['Fail2ban parameters', 'operations/fail2ban'],
] as const

const NAVIGATION = 'Toggle navigation'

const OPERATIONS_PATHS =
  /^\/api\/v2\/(capabilities\/monitoring|host|installation|containers|logs|rspamd|mail-queue|fail2ban)/

test.describe('operations navigation @operations', () => {
  test('administrators find the System and Containers group with dashboard, logs and audit tabs', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
  }) => {
    await mockApi.use('admin-operations')
    await page.goto('')
    await expect(page.getByRole('heading', { level: 1, name: 'System & Containers' })).toBeVisible()
    const menu = page.getByRole('button', { name: NAVIGATION })
    if (await menu.isVisible()) await menu.click()
    const group = page.getByRole('list', { name: 'System', exact: true })
    await expect(group.getByRole('link')).toHaveText(['System & Containers'])
    await group.getByRole('link').click()
    const tabs = page.locator('[data-section-navigation]')
    if (await tabs.getByRole('button').isVisible()) await tabs.getByRole('button').click()
    await expect(tabs.getByRole('link')).toHaveText(['System & Containers', 'Logs', 'Audit log'])
    await tabs.getByRole('link', { name: 'Logs', exact: true }).click()
    await expect(page).toHaveURL(/\/ng\/operations\/logs\/postfix/)
    await expectAccessible()
    await expectNoHorizontalScroll()
    // The queue remains directly addressable, and Fail2ban is in the Options group.
    for (const [, path] of SCREENS.slice(2)) {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await expectNoHorizontalScroll()
    }
  })

  for (const scenario of ['domain-admin-operations', 'mailbox-user-operations']) {
    test(`FR-001 ${scenario} gets no System entry and no access to its addresses`, async ({
      page,
      mockApi,
      expectAccessible,
    }) => {
      await mockApi.use(scenario)
      await page.goto('')
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await expect(page.getByRole('list', { name: 'System', exact: true })).toHaveCount(0)
      for (const [, path] of SCREENS) {
        await page.goto(path)
        await expect(page.getByRole('heading', { name: 'No access' })).toBeVisible()
      }
      await expectAccessible()
      const requests = await mockApi.requests()
      expect(requests.filter((request) => OPERATIONS_PATHS.test(request.path))).toEqual([])
    })
  }

  test('FR-001 administrators land directly on System and Containers', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('admin-operations')
    await page.goto('')
    await expect(page).toHaveURL(/\/ng\/operations\/dashboard$/)
  })
})
