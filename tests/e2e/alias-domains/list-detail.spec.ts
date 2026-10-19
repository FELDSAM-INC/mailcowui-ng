// UI 004 US4, the domain alias list and page (T060), the classic "Domain aliases" tab
// (`tab-domain-aliases.twig`, `draw_aliasdomain_table()`) and `edit/aliasdomain.twig`: names, the
// target with its link and legacy's relay badge, active, search, filters and sort in the address,
// the entry menu, the add control only with `aliasDomains`, the read-only rate limit in its legacy
// position, the page states, the domain administrator's scope and a relay-targeted alias domain.
import { ALIAS_DOMAINS_SCENARIO as AD } from '../../mocks/scenarios/alias-domains'
import { expect, test } from '../fixtures/test'
import { isNarrow, listReady } from '../aliases/helpers'
import { entry, requestsOf, saveButton, section, trigger } from './helpers'

test.describe('domain aliases: list and page', () => {
  test('FR-033 US4-AS9 the list shows the name, the linked target, active and the relay badge', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
  }) => {
    await mockApi.use('alias-domains-admin')
    await page.goto('alias-domains')
    await listReady(page)
    await expect(page.getByRole('heading', { level: 1, name: 'Domain aliases' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Add domain alias' })).toBeVisible()
    const row = entry(page, AD.withAliases)
    await expect(row.getByRole('link', { name: AD.target })).toHaveAttribute(
      'href',
      /\/ng\/domains\/example\.org$/,
    )
    await expect(entry(page, AD.relayTargeted)).toContainText(
      'Alias domain inactive for relay domain',
    )
    await expectAccessible()
    await expectNoHorizontalScroll()
  })

  test('FR-034 search, the target and active filters and the sort live in the address', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('alias-domains-admin')
    await page.goto('alias-domains')
    await listReady(page)
    await page.getByRole('searchbox', { name: 'Search:' }).fill('legacy')
    await expect(page).toHaveURL(/q=legacy/)
    await expect(page.locator('[data-entry]')).toHaveCount(1)
    await page.goto('alias-domains?active=false')
    await listReady(page)
    await expect(page.locator('[data-entry]')).toHaveCount(0)
    await page.goto(`alias-domains?targetDomain=${AD.target}`)
    await listReady(page)
    await expect(page.locator('[data-entry]')).toHaveCount(1)
    await expect(entry(page, AD.withAliases)).toBeVisible()
    await page.goto('alias-domains?sort=targetDomain&order=desc')
    await listReady(page)
    const [request] = (await requestsOf(mockApi, 'listAliasDomains')).slice(-1)
    expect(request).toBeTruthy()
    if (!isNarrow(page)) {
      await expect(page.getByRole('columnheader', { name: 'Target domain' })).toHaveAttribute(
        'aria-sort',
        'descending',
      )
    }
  })

  test('FR-035 the page shows the rate limit read-only under "Rate limit"', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('alias-domains-admin')
    await page.goto(`alias-domains/${AD.withAliases}`)
    await expect(page.getByRole('heading', { level: 1, name: 'Edit Alias domain' })).toBeVisible()
    await expect(page.locator('[data-field="rateLimit"]')).toHaveText('Disabled')
    await mockApi.patch({
      changeElsewhere: {
        aliasDomain: { [AD.withAliases]: { rateLimit: { value: 10, frame: 'hour' } } },
      },
    })
    await page.reload()
    await expect(page.locator('[data-field="rateLimit"]')).toHaveText('10 msgs / hour')
  })

  test('US4-AS3 without "aliasDomains" there is no add control, but Edit and Remove stay', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('alias-domains-da-no-flags')
    await page.goto('alias-domains')
    await listReady(page)
    await expect(page.getByRole('link', { name: 'Add domain alias' })).toHaveCount(0)
    await trigger(page, AD.withAliases).click()
    await expect(page.getByRole('menuitem', { name: 'Edit' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Remove' })).toBeVisible()
  })

  test('FR-015 the entry menu has a 44 px trigger, and Edit opens the section', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('alias-domains-admin')
    await page.goto('alias-domains')
    await listReady(page)
    const box = await trigger(page, AD.withAliases).boundingBox()
    expect(box!.width).toBeGreaterThanOrEqual(44)
    expect(box!.height).toBeGreaterThanOrEqual(44)
    await trigger(page, AD.withAliases).click()
    await page.getByRole('menuitem', { name: 'Edit' }).click()
    await expect(page).toHaveURL(/\/alias-domains\/example\.net\?edit=general$/)
    await expect(section(page).getByRole('checkbox', { name: 'Active' })).toBeVisible()
  })

  test('FR-008 Edge: a temporary failure gives the error state with a retry', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('alias-domains-store-down')
    await page.goto('alias-domains')
    await expect(page.locator('[data-list-state="error"]')).toBeVisible()
    await expect(page.getByText('temporarily unavailable', { exact: false })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
  })

  test('FR-003 an unknown alias domain is "not found" with a way back', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('alias-domains-admin')
    await page.goto('alias-domains/nothing.example')
    await expect(page.getByRole('link', { name: 'Back to the list' })).toBeVisible()
  })

  test("the domain administrator sees only the scope's alias domains", async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('alias-domains')
    await page.goto('alias-domains')
    await listReady(page)
    await expect(entry(page, AD.withAliases)).toBeVisible()
    await expect(entry(page, 'example.eu')).toBeVisible()
    await expect(entry(page, AD.relayTargeted)).toHaveCount(0)
  })

  test('Edge: an alias domain whose target became a relay domain stays editable', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('alias-domains-admin')
    await page.goto(`alias-domains/${AD.relayTargeted}?edit=general`)
    await section(page).getByRole('checkbox', { name: 'Active' }).click()
    await saveButton(page).click()
    await expect(section(page).locator('[role="status"]').first()).toHaveText(
      `Changes to alias domain ${AD.relayTargeted} have been saved`,
    )
    const [request] = await requestsOf(mockApi, 'updateAliasDomain')
    expect(request!.body).toEqual({ active: false })
  })
})
