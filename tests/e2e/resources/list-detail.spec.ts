// UI 004 US7, the resource list and page (T091), the classic "Resources" tab
// (`tab-resources.twig`, `draw_resource_table()`) and `edit/resource.twig`: description, address,
// kind, domain, legacy's booking badges with the legend, active; search, filters and sort in the
// address; the entry menu; the page with the address and domain read-only; no "Send as"; the page
// states and the domain administrator's scope.
import { RESOURCES_004 } from '../../mocks/scenarios/resources'
import { expect, test } from '../fixtures/test'
import { isNarrow, listReady } from '../aliases/helpers'
import { entry, section, trigger } from './helpers'

test.describe('resources: list and page', () => {
  test('FR-042 US7-AS5 the list shows the classic columns with the booking badges and the legend', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
  }) => {
    await mockApi.use('resources')
    await page.goto('resources')
    await listReady(page)
    await expect(page.getByRole('heading', { level: 1, name: 'Resources' })).toBeVisible()
    const room = entry(page, RESOURCES_004.meetingRoom)
    await expect(room).toContainText('Meeting Room 1')
    await expect(room).toContainText('Location')
    await expect(room).toContainText('Soft limit')
    await expect(entry(page, RESOURCES_004.projector)).toContainText('Always free')
    await expect(entry(page, RESOURCES_004.teamCalendar)).toContainText('Hard limit (2)')
    const legend = page.locator('[data-booking-legend]')
    await expect(legend).toContainText('Always free')
    await expect(legend).toContainText('Always show as free')
    await expect(legend).toContainText('Hard-limit to a custom amount of bookings')
    await expectAccessible()
    await expectNoHorizontalScroll()
  })

  test('FR-043 search, the domain, kind and active filters and the sort live in the address', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('resources')
    await page.goto('resources')
    await listReady(page)
    await page.getByRole('searchbox', { name: 'Search:' }).fill('desk')
    await expect(page).toHaveURL(/q=desk/)
    await expect(page.locator('[data-entry]')).toHaveCount(5)
    await expect(page.locator('[data-live="polite"]')).toHaveText('Showing 1 to 5 of 5 entries')
    await page.goto('resources?kind=location')
    await listReady(page)
    await expect(entry(page, RESOURCES_004.meetingRoom)).toBeVisible()
    await expect(entry(page, RESOURCES_004.projector)).toHaveCount(0)
    await page.goto('resources?active=false')
    await listReady(page)
    await expect(page.locator('[data-entry]')).toHaveCount(1)
    await page.goto('resources?domain=example.com')
    await listReady(page)
    await expect(entry(page, RESOURCES_004.van)).toBeVisible()
    await page.goto('resources?sort=description&order=desc')
    await listReady(page)
    if (!isNarrow(page)) {
      await expect(page.getByRole('columnheader', { name: 'Description' })).toHaveAttribute(
        'aria-sort',
        'descending',
      )
    }
  })

  test('FR-015 the menu has Edit, which opens the section, and Remove', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('resources')
    await page.goto('resources')
    await listReady(page)
    const box = await trigger(page, RESOURCES_004.meetingRoom).boundingBox()
    expect(box!.width).toBeGreaterThanOrEqual(isNarrow(page) ? 44 : 32)
    await trigger(page, RESOURCES_004.meetingRoom).click()
    await expect(page.getByRole('menuitem', { name: 'Remove' })).toBeVisible()
    await page.getByRole('menuitem', { name: 'Edit' }).click()
    await expect(page).toHaveURL(/\/resources\/MeetingRoom1@example\.org\?edit=resource$/)
    await expect(section(page).getByRole('textbox', { name: 'Description' })).toBeVisible()
  })

  test('FR-046 FR-048 the page shows the address and domain read-only, and no "Send as"', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('resources')
    await page.goto(`resources/${RESOURCES_004.meetingRoom}`)
    await expect(page.getByRole('heading', { level: 1, name: 'Resource' })).toBeVisible()
    await expect(page.locator('[data-field="address"]')).toHaveText(RESOURCES_004.meetingRoom)
    await expect(page.locator('[data-field="domain"]')).toContainText('example.org')
    await expect(page.getByText('Allow to send as')).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Remove|Delete/ })).toHaveCount(0)
  })

  test('FR-003 an unknown resource is "not found"', async ({ page, mockApi }) => {
    await mockApi.use('resources')
    await page.goto('resources/Nothing@example.org')
    await expect(page.getByRole('link', { name: 'Back to the list' })).toBeVisible()
  })

  test("the domain administrator sees only the scope's resources", async ({ page, mockApi }) => {
    await mockApi.use('resources-da')
    await page.goto('resources')
    await listReady(page)
    await expect(entry(page, RESOURCES_004.meetingRoom)).toBeVisible()
    await expect(entry(page, RESOURCES_004.teamCalendar)).toHaveCount(0)
  })
})
