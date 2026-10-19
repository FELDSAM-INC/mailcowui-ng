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
  test('FR-001 administrators find Dashboard, Logs, Mail queue and Fail2ban under System', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
  }) => {
    await mockApi.use('admin-operations')
    await page.goto('')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    const menu = page.getByRole('button', { name: NAVIGATION })
    const group = page.getByRole('list', { name: 'System', exact: true })
    const openNavigation = async () => {
      if ((await menu.isVisible()) && !(await group.isVisible())) await menu.click()
    }
    await openNavigation()
    await expect(group.getByRole('link')).toHaveText(SCREENS.map(([name]) => name))
    await expectAccessible()
    for (const [name, path] of SCREENS) {
      await openNavigation()
      await group.getByRole('link', { name, exact: true }).click()
      await expect(page).toHaveURL(new RegExp(`/ng/${path}`))
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await expect(page.getByText('Page not found')).toHaveCount(0)
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

  test('FR-001 the home screen stays the landing screen of administrators', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('admin-operations')
    await page.goto('')
    await expect(page).toHaveURL(/\/ng\/$/)
  })
})
