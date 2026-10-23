// UI 010 US1, the ARC/DKIM keys list (T031): entries, cards and table, filters, search, sort,
// paging, the address, the list states, the server settings and the edge cases.
import { LONG_NAME } from '../../mocks/scenarios/dns'
import { politeRegion } from '../fixtures/flows'
import { expect, test } from '../fixtures/test'
import {
  FIRST_LOAD,
  entry,
  entryNames,
  isNarrow,
  listReady,
  openFilters,
  resultCount,
} from './helpers'

const ADMIN_NAMES = [
  LONG_NAME,
  'example.com',
  'example.net',
  'example.org',
  'incomplete.example',
  'Legacy.Example',
  'missing.example',
  'old.example',
  'shop.example',
  'xn--bcher-kva.example',
]

test.describe('DKIM key list', () => {
  test('US1-AS1 US1-AS2 FR-007 every entry sorted by name, with badges and the total', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
    expectTouchTargets,
  }) => {
    await mockApi.use('dns-admin')
    await page.goto('dns/dkim-keys')
    await expect(page.getByRole('heading', { level: 1, name: 'ARC/DKIM keys' })).toBeVisible({
      timeout: FIRST_LOAD,
    })
    await listReady(page)
    expect((await entryNames(page)).map((name) => name.toLowerCase())).toEqual(
      ADMIN_NAMES.map((name) => name.toLowerCase()),
    )
    expect(await resultCount(page)).toBe('10 entries')
    const org = entry(page, 'example.org')
    await expect(org).toContainText('Key valid')
    await expect(org).toContainText('Domain')
    await expect(org).toContainText('dkim')
    await expect(org).toContainText('2,048')
    await expect(entry(page, 'example.com')).toContainText('Alias domain')
    await expect(entry(page, 'example.net')).toContainText('Key missing')
    await expect(entry(page, 'xn--bcher-kva.example')).toContainText('bücher.example')
    if (isNarrow(page)) {
      await expect(page.getByRole('list', { name: 'ARC/DKIM keys' })).toBeVisible()
      await expect(org.getByRole('heading', { level: 3, name: /example\.org/ })).toBeVisible()
      await expectTouchTargets()
    } else {
      const header = page.getByRole('columnheader', { name: 'Domain' })
      await expect(header).toHaveAttribute('aria-sort', 'ascending')
      await page
        .getByRole('columnheader', { name: 'DKIM key length (bits)' })
        .getByRole('button')
        .click()
      await expect(page).toHaveURL(/sort=keyLength/)
      await expect(
        page.getByRole('columnheader', { name: 'DKIM key length (bits)' }),
      ).toHaveAttribute('aria-sort', 'ascending')
    }
    await expectAccessible()
    await expectNoHorizontalScroll()
  })

  test('US1-AS5 FR-009 "Key missing" shows only names without a key and is announced', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('dns-admin')
    await page.goto('dns/dkim-keys')
    await listReady(page)
    await openFilters(page)
    await page.getByRole('checkbox', { name: 'Key missing' }).check()
    await expect(page).toHaveURL(/state=missing/)
    await expect.poll(() => entryNames(page)).toEqual(['example.net', 'missing.example'])
    await expect(page.getByRole('button', { name: 'Filters (1)' })).toBeVisible()
    await expect(politeRegion(page)).toHaveText('2 entries')
  })

  test('US1-AS6 a domain administrator sees exactly their entries, without the unused filters', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('dns-domain-admin')
    await page.goto('dns/dkim-keys')
    await listReady(page)
    expect(await entryNames(page)).toEqual([
      'example.com',
      'example.net',
      'example.org',
      'missing.example',
    ])
    await openFilters(page)
    await expect(page.getByRole('checkbox', { name: 'Key unused' })).toHaveCount(0)
    await expect(page.locator('#dkim-filter-kind option', { hasText: 'No domain' })).toHaveCount(0)
    await expect(page.locator('[data-dkim-settings]')).toHaveCount(0)
    await expectAccessible()
  })

  test('US1-AS7 an incomplete key says so; Edge: an unused legacy spelling is listed', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('dns-admin')
    await page.goto('dns/dkim-keys')
    await listReady(page)
    await expect(entry(page, 'incomplete.example')).toContainText('Incomplete')
    await expect(entry(page, 'Legacy.Example')).toContainText('Key unused')
    await expect(entry(page, 'Legacy.Example')).toContainText('No domain')
  })

  test('US1-AS8 FR-008 no matches, then clearing the search and filters', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('dns-admin')
    await page.goto('dns/dkim-keys')
    await listReady(page)
    const search = page.getByRole('searchbox', { name: 'Search:' })
    await search.fill('nothing-like-this')
    await expect(page).toHaveURL(/q=nothing-like-this/)
    await expect(page.getByText('No matching records found')).toBeVisible()
    await page.getByRole('button', { name: 'Clear all filters' }).click()
    await expect(page).not.toHaveURL(/q=/)
    await listReady(page)
    expect(await entryNames(page)).toHaveLength(10)
    await search.fill('bücher')
    await search.press('Enter')
    await expect.poll(() => entryNames(page)).toEqual(['xn--bcher-kva.example'])
    await page.getByRole('button', { name: 'Clear search' }).click()
    await expect(page).not.toHaveURL(/q=/)
  })

  test('FR-005 FR-011 pages of 25, 50 and 100, restored from the address', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('dns-many')
    await page.goto('dns/dkim-keys')
    await listReady(page)
    expect(await entryNames(page)).toHaveLength(25)
    expect(await resultCount(page)).toBe('600 entries')
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await expect(page).toHaveURL(/page=2/)
    await expect(entry(page, 'd026.example')).toBeVisible()
    await page.getByRole('button', { name: 'Last', exact: true }).click()
    await expect(page.getByText('Page 24 of 24')).toBeVisible()
    await page.locator('[data-page-size] select').selectOption('50')
    await expect(page).toHaveURL(/size=50/)
    await expect(page).not.toHaveURL(/page=/)
    expect(await entryNames(page)).toHaveLength(50)
    await page.goto('dns/dkim-keys?size=100&page=2&state=missing')
    await listReady(page)
    await expect(page.getByText('Page 2 of 2')).toBeVisible()
    expect(await resultCount(page)).toBe('120 entries')
    await page.reload()
    await expect(page.getByText('Page 2 of 2')).toBeVisible()
    await openFilters(page)
    await page.getByRole('checkbox', { name: 'Key valid' }).check()
    await expect(page).not.toHaveURL(/page=2/)
  })

  test('FR-009 FR-010 kind, completeness, a selector from the filter panel, and clearing everything', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('dns-admin')
    await page.goto('dns/dkim-keys')
    await listReady(page)
    await openFilters(page)
    await page.locator('#dkim-filter-selector').fill('shop')
    await page.locator('#dkim-filter-selector').press('Tab')
    await expect(page).toHaveURL(/selector=shop/)
    await expect.poll(() => entryNames(page)).toEqual(['shop.example'])
    await page.getByRole('button', { name: 'Remove filter: Selector shop' }).click()
    await openFilters(page)
    await page.locator('#dkim-filter-kind').selectOption('aliasDomain')
    await expect.poll(() => entryNames(page)).toEqual(['example.com', 'missing.example'])
    await page.locator('#dkim-filter-kind').selectOption('')
    await page.locator('#dkim-filter-complete').selectOption('false')
    await expect.poll(() => entryNames(page)).toEqual(['incomplete.example'])
    await page.locator('[data-clear-filters]').click()
    await expect.poll(async () => (await entryNames(page)).length).toBe(10)
    if (isNarrow(page)) {
      await page.locator('#dkim-sort').selectOption('selector')
      await page.locator('#dkim-order').selectOption('desc')
      await expect(page).toHaveURL(/sort=selector&order=desc|order=desc&sort=selector/)
    }
  })

  test('FR-012 the domain filter lists a domain with its alias domains', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('dns-admin')
    await page.goto('dns/dkim-keys?domain=example.org')
    await listReady(page)
    expect(await entryNames(page)).toEqual(['example.com', 'example.org'])
    await expect(
      page.getByRole('button', { name: /Remove filter: Domain example.org/ }),
    ).toBeVisible()
  })

  test('FR-013 returning from an entry shows the previous results at once', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('dns-many')
    await page.goto('dns/dkim-keys?page=3')
    await listReady(page)
    const target = entry(page, 'd060.example')
    await target.scrollIntoViewIfNeeded()
    await target.press('Enter')
    await expect(page.getByRole('heading', { level: 1, name: 'd060.example' })).toBeVisible()
    await page.goBack()
    await expect(page.locator('[data-list-loading]')).toHaveCount(0)
    await expect(entry(page, 'd060.example')).toBeInViewport()
  })

  test('FR-014 the loading, error and empty states, and a failed refresh keeping the results', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('dns-empty-admin')
    await page.goto('dns/dkim-keys')
    await expect(page.locator('[data-dkim-empty]')).toContainText('No data available in table')
    await expect(
      page.locator('[data-dkim-empty]').getByRole('link', { name: 'Domains' }),
    ).toBeVisible()
    await expectAccessible()

    await mockApi.use('dns-admin')
    await mockApi.failNext('listDkimKeys', { status: 500 })
    await page.goto('dns/dkim-keys')
    await expect(page.getByText('The list could not be loaded.')).toBeVisible()
    await page.getByRole('button', { name: 'Try again' }).click()
    await listReady(page)
    expect(await entryNames(page)).toHaveLength(10)
    await mockApi.failNext('listDkimKeys', { status: 500 })
    await page.getByRole('button', { name: 'Refresh' }).click()
    await expect(page.getByText('The list could not be refreshed.')).toBeVisible()
    expect(await entryNames(page)).toHaveLength(10)
  })

  test('FR-015 administrators see the server settings', async ({ page, mockApi }) => {
    await mockApi.use('dns-admin-fork')
    await page.goto('dns/dkim-keys')
    const settings = page.locator('[data-dkim-settings]')
    await expect(settings).toContainText('feldhost')
    await expect(settings).toContainText('2,048')
    await expect(settings).toContainText('Private key export')
    await expect(settings).toContainText('On')
  })

  test('Edge: a 253-character name wraps without horizontal scrolling', async ({
    page,
    mockApi,
    expectNoHorizontalScroll,
  }) => {
    await mockApi.use('dns-admin')
    await page.goto(`dns/dkim-keys?q=${'a'.repeat(30)}`)
    await listReady(page)
    await expect(entry(page, LONG_NAME)).toBeVisible()
    await expectNoHorizontalScroll()
  })
})
