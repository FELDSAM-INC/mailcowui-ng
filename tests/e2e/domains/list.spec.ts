// UI 002 US1, the domain list (T034): paging, cards and table, search, filters, sort, address
// state, refresh, the list states, usage pairs and the edge cases.
import { expect, test } from '../fixtures/test'
import {
  entries,
  entry,
  entryNames,
  isNarrow,
  listReady,
  openFilters,
  resultCount,
} from './helpers'

const LONG = `${'a'.repeat(63)}.${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(53)}.example`

test.describe('domain list', () => {
  test('US1-AS1 the first 25 of 60 sorted by name, with the total and the way to other pages', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
  }) => {
    await mockApi.use('domains-60')
    await page.goto('domains')
    await expect(page.getByRole('heading', { level: 1, name: 'Domains' })).toBeVisible()
    await listReady(page)
    const names = await entryNames(page)
    expect(names).toHaveLength(25)
    expect(names).toEqual([...names].sort())
    expect(await resultCount(page)).toBe('Domains found: 60')
    await expect(page.getByText('Page 1 of 3')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeEnabled()
    await expectAccessible()
    await expectNoHorizontalScroll()
  })

  test('US1-AS2 FR-006 cards at 360 px show every value and need no horizontal scroll', async ({
    page,
    mockApi,
    expectTouchTargets,
    expectNoHorizontalScroll,
  }) => {
    test.skip(!isNarrow(page), 'cards are the small-screen layout')
    await mockApi.use('domains-60')
    await page.goto('domains?q=nearly')
    const card = entry(page, 'nearly.example')
    await expect(card.getByRole('heading', { name: 'nearly.example' })).toBeVisible()
    await expect(card).toContainText('Active')
    await expect(card).toContainText('8 of 10')
    await expect(card).toContainText('380 of 400')
    await expect(card).toContainText('9.5 GiB of 10 GiB')
    await expect(card).toContainText('7.3 GiB')
    await expect(card).toContainText('12,345')
    await expect(page.getByRole('list', { name: 'Domains' })).toBeVisible()
    await expectTouchTargets()
    await expectNoHorizontalScroll()
  })

  test('FR-007 the wide table has the extra columns, and expanding an entry shows the rest', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('domains-60')
    await page.goto('domains?q=relayhost')
    const item = entry(page, 'relayhost.example')
    if (!isNarrow(page)) {
      const table = page.getByRole('table')
      for (const header of ['Domain', 'Mailboxes', 'Aliases', 'Quota allocated', 'Storage used']) {
        await expect(table.getByRole('columnheader', { name: new RegExp(header) })).toBeVisible()
      }
      await expect(table.getByRole('columnheader', { name: /Rate limit/ })).toBeVisible()
      await expect(item).toContainText('10 msgs / hour')
    }
    const toggle = page.getByRole('button', { name: 'Details of relayhost.example' })
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    const details = page.locator('[data-entry-details="relayhost.example"]')
    await expect(details).toContainText('Relay this domain')
    await expect(details).toContainText('Created on')
    await expect(details).toContainText('Last modified')
    await expect(details).toContainText('Never')
    await expect(details).not.toContainText('Default mailbox quota')
    await expect(details).toContainText('10 GiB')
    await expect(details).toContainText('Domain administrators')
    await expectAccessible()
  })

  test('US1-AS3 the search finds both customers, and a tag on an entry becomes an active filter', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('domains-60')
    await page.goto('domains')
    await listReady(page)
    await page.getByRole('searchbox', { name: 'Search domains' }).fill('customer')
    await expect.poll(() => entryNames(page)).toEqual(['customer-a.example', 'customer-b.example'])
    await page.getByRole('button', { name: 'Clear search' }).click()
    await expect.poll(async () => (await entryNames(page)).length).toBe(25)
    await page.goto('domains?q=customer-a')
    await entry(page, 'customer-a.example')
      .getByRole('button', { name: 'Filter by tag customer-a' })
      .click()
    await expect(page).toHaveURL(/tag=customer-a/)
    await expect(page.getByRole('button', { name: 'Filters (1)' })).toBeVisible()
    await expectAccessible()
  })

  test('FR-010 the active and relay filters, tag suggestions and "clear all"', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('domains-60')
    await page.goto('domains')
    await listReady(page)
    await openFilters(page)
    await page.getByLabel('Active state').selectOption('inactive')
    await expect(page).toHaveURL(/active=inactive/)
    await expect.poll(() => resultCount(page)).toBe('Domains found: 26')
    await page.getByLabel('Relay', { exact: true }).selectOption('relay')
    await expect(page).toHaveURL(/relay=relay/)
    const tags = page.getByRole('combobox', { name: 'Tags' })
    await tags.fill('custom')
    await expect(page.getByRole('option', { name: 'customer-a' })).toBeVisible()
    await page.getByRole('option', { name: 'customer-b' }).click()
    await expect(page).toHaveURL(/tag=customer-b/)
    await expect(page.getByRole('button', { name: 'Filters (3)' })).toBeVisible()
    await page.getByRole('button', { name: 'Clear all filters' }).click()
    await expect(page).not.toHaveURL(/active=|relay=|tag=/)
    await expect.poll(() => resultCount(page)).toBe('Domains found: 60')
  })

  test('US1-AS4 an internationalised name is shown readable above its ASCII form, and both are found', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('domains-60')
    await page.goto('domains')
    await listReady(page)
    const search = page.getByRole('searchbox', { name: 'Search domains' })
    await search.fill('münchen')
    await expect.poll(() => entryNames(page)).toEqual(['xn--mnchen-3ya.de'])
    const item = entry(page, 'xn--mnchen-3ya.de')
    await expect(item.getByText('münchen.de', { exact: true })).toBeVisible()
    await expect(item.getByText('xn--mnchen-3ya.de', { exact: true })).toBeVisible()
    await search.fill('xn--mnchen')
    await expect.poll(() => entryNames(page)).toEqual(['xn--mnchen-3ya.de'])
  })

  test('US1-AS5 Back restores the page, sort, filters, search and scroll at once; reload and a new tab too', async ({
    page,
    context,
    mockApi,
  }) => {
    await mockApi.use('domains-60')
    await page.goto('domains?sort=storageUsed&order=desc&page=2&active=active')
    await listReady(page)
    const before = await entryNames(page)
    expect(before.length).toBeGreaterThan(0)
    // Scroll to the last entry and open it with a DOM click, so the position is kept as it is.
    const last = before.at(-1)!
    const link = page.locator(`[data-entry="${last}"] a`).first()
    await link.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    const scrolled = await page.evaluate(() => window.scrollY)
    await link.evaluate((element) => (element as HTMLAnchorElement).click())
    await expect(page).toHaveURL(new RegExp(`/ng/domains/${last.replace(/\./g, '\\.')}$`))
    await page.goBack()
    await expect(page).toHaveURL(/page=2/)
    await expect(page.locator('[data-list-loading]')).toHaveCount(0)
    expect(await entryNames(page)).toEqual(before)
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeGreaterThanOrEqual(Math.max(0, scrolled - 2))
    await page.reload()
    await listReady(page)
    expect(await entryNames(page)).toEqual(before)
    const second = await context.newPage()
    await second.goto(page.url())
    await listReady(second)
    expect(await entryNames(second)).toEqual(before)
    await second.close()
  })

  test('US1-AS6 the reseller sees exactly 2 domains, no domain administrators, create, delete or bulk action', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('domain-admin-two-of-ten')
    await page.goto('domains')
    await listReady(page)
    expect(await entryNames(page)).toEqual(['customer-a.example', 'customer-b.example'])
    expect(await resultCount(page)).toBe('Domains found: 2')
    await expect(page.getByRole('link', { name: 'Add domain' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Select' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Details of customer-a.example' }).click()
    await expect(page.locator('[data-entry-details="customer-a.example"]')).not.toContainText(
      'Domain administrators',
    )
    await expectAccessible()
  })

  test('US1-AS7 no match shows a message whose action clears the search and filters', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('domains-60')
    await page.goto('domains?q=nothing-matches&active=inactive')
    await expect(page.getByText('No domains match the search and filters.')).toBeVisible()
    await expect(page.getByRole('table')).toHaveCount(0)
    await expectAccessible()
    await page.getByRole('button', { name: 'Clear search and filters' }).click()
    await expect(page).not.toHaveURL(/q=|active=/)
    await expect.poll(() => resultCount(page)).toBe('Domains found: 60')
  })

  test('US1-AS8 usage pairs as text and bars, with nearly full marked by text', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('domains-60')
    await page.goto('domains?q=nearly')
    const item = entry(page, 'nearly.example')
    await expect(item.locator('[data-usage="mailboxes"]')).toContainText('8 of 10')
    await expect(item.locator('[data-usage="mailboxes"]')).not.toContainText('Nearly full')
    await expect(item.locator('[data-usage="aliases"]')).toContainText('380 of 400')
    await expect(item.locator('[data-usage="aliases"]')).toContainText('Nearly full')
    await expect(item.locator('[data-usage="quota"]')).toContainText('9.5 GiB of 10 GiB')
    await expect(item.locator('[data-usage="quota"]')).toContainText('Nearly full')
    await expect(item.locator('[data-usage="quota"] [data-bar]')).toHaveAttribute(
      'aria-hidden',
      'true',
    )
  })

  test('FR-005 page sizes, first, previous, next and last, and the page number', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('domains-60')
    await page.goto('domains')
    await listReady(page)
    await page.getByRole('button', { name: 'Last', exact: true }).click()
    await expect(page.getByText('Page 3 of 3')).toBeVisible()
    expect(await entryNames(page)).toHaveLength(10)
    await page.getByRole('button', { name: 'Previous', exact: true }).click()
    await expect(page.getByText('Page 2 of 3')).toBeVisible()
    await page.getByRole('button', { name: 'First', exact: true }).click()
    await expect(page.getByText('Page 1 of 3')).toBeVisible()
    await page.locator('[data-page-size] select').selectOption('50')
    await expect(page).toHaveURL(/size=50/)
    await expect.poll(async () => (await entryNames(page)).length).toBe(50)
    await page.locator('[data-page-size] select').selectOption('100')
    await expect.poll(async () => (await entryNames(page)).length).toBe(60)
  })

  test('FR-009 results follow the typing once it pauses, with one request', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('domains-60')
    await page.goto('domains')
    await listReady(page)
    await page
      .getByRole('searchbox', { name: 'Search domains' })
      .pressSequentially('customer', { delay: 40 })
    await expect.poll(() => entryNames(page)).toEqual(['customer-a.example', 'customer-b.example'])
    const searches = (await mockApi.requests()).filter(
      (request) => request.operationId === 'listDomains' && request.path.includes('q='),
    )
    expect(
      searches.map((request) => new URL(request.path, 'http://x').searchParams.get('q')),
    ).toEqual(['customer'])
  })

  test('FR-011 every sort key from the sort control, and headers with aria-sort on wide screens', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('domains-60')
    await page.goto('domains')
    await listReady(page)
    const sort = page.getByLabel('Sort by')
    const options = await sort.locator('option').allTextContents()
    // Every sort key of the contract but the default mailbox quota (owner decision).
    expect(options).toHaveLength(14)
    await sort.selectOption('storageUsed')
    await page.getByLabel('Order').selectOption('desc')
    await expect(page).toHaveURL(/sort=storageUsed&order=desc|order=desc&sort=storageUsed/)
    if (!isNarrow(page)) {
      const header = page.getByRole('columnheader', { name: /Storage used/ })
      await expect(header).toHaveAttribute('aria-sort', 'descending')
      await page
        .getByRole('columnheader', { name: /Mailboxes/ })
        .getByRole('button')
        .click()
      await expect(page).toHaveURL(/sort=mailboxes/)
      await expect(page.getByRole('columnheader', { name: /Mailboxes/ })).toHaveAttribute(
        'aria-sort',
        'ascending',
      )
    }
  })

  test('FR-012 a new search, filter, sort or size returns to page 1, and nothing goes to storage', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('domains-60')
    await page.goto('domains?page=2')
    await listReady(page)
    await page.getByLabel('Sort by').selectOption('description')
    await expect(page).not.toHaveURL(/page=2/)
    await page.goto('domains?page=2')
    await page.getByRole('searchbox', { name: 'Search domains' }).fill('domain')
    await expect(page).not.toHaveURL(/page=2/)
    const stored = await page.evaluate(() => ({
      local: Object.keys(localStorage).filter((key) => /domain|list/i.test(key)),
      session: Object.keys(sessionStorage).filter((key) => /domain|list/i.test(key)),
    }))
    expect(stored).toEqual({ local: [], session: [] })
  })

  test('FR-013 refresh reloads the list', async ({ page, mockApi }) => {
    await mockApi.use('domains-60')
    await page.goto('domains')
    await listReady(page)
    await mockApi.patch({ domains: { remove: ['customer-a.example'] } })
    await page.getByRole('button', { name: 'Refresh' }).click()
    await expect.poll(() => resultCount(page)).toBe('Domains found: 59')
  })

  test('FR-014 loading placeholders, the empty states, the error with retry, and a failed refresh', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('domains-60', { delays: { listDomains: 1500 } })
    await page.goto('domains')
    await expect(page.locator('[data-list-loading]')).toBeVisible()
    await listReady(page)
    await mockApi.patch({ delays: { listDomains: 0 } })

    await mockApi.use('domains-empty')
    await page.goto('domains')
    await expect(page.getByText('There are no domains yet.')).toBeVisible()
    await expectAccessible()

    await mockApi.use('admin-active', {
      signedInAs: 'reseller',
      domainAssignments: { reseller: [] },
    })
    await page.goto('domains')
    await expect(page.getByText('No domain is assigned to you yet.')).toBeVisible()

    await mockApi.use('domains-list-error')
    await page.goto('domains')
    await expect(page.getByText('The list could not be loaded.')).toBeVisible()
    await expectAccessible()
    await mockApi.patch({ failures: { listDomains: { status: 500, times: 0 } } })
    await page.getByRole('button', { name: 'Try again' }).click()
    await listReady(page)
    expect(await entryNames(page)).toHaveLength(25)

    await mockApi.patch({ failures: { listDomains: { status: 500 } } })
    await page.getByRole('button', { name: 'Refresh' }).click()
    await expect(page.getByText('The list could not be refreshed.')).toBeVisible()
    expect(await entryNames(page)).toHaveLength(25)
  })

  test('FR-072 FR-073 cards are a list with name headings, and the result count is announced', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('domains-60')
    await page.goto('domains')
    await listReady(page)
    if (isNarrow(page)) {
      const list = page.getByRole('list', { name: 'Domains' })
      await expect(list.getByRole('listitem').first().getByRole('heading')).toBeVisible()
    } else {
      await expect(page.getByRole('table').getByRole('columnheader').first()).toBeVisible()
    }
    await page.getByRole('searchbox', { name: 'Search domains' }).fill('customer')
    await expect(page.locator('[data-live="polite"]')).toHaveText('Domains found: 2')
  })

  test('Edge: a 253-character name wraps, many tags show "+n", 12 of 10 is over, zero limits show 0', async ({
    page,
    mockApi,
    expectNoHorizontalScroll,
  }) => {
    await mockApi.use('domains-60')
    await page.goto('domains')
    await listReady(page)
    await expect(entry(page, LONG)).toBeVisible()
    await expectNoHorizontalScroll()
    await page.goto('domains?q=many-tags')
    const many = entry(page, 'many-tags.example')
    const shown = isNarrow(page) ? 5 : 3
    await expect(many).toContainText(`+${12 - shown}`)
    await expect(many.getByRole('button', { name: /^Filter by tag/ })).toHaveCount(shown)
    await page.goto('domains?q=over.example')
    await expect(entry(page, 'over.example').locator('[data-usage="mailboxes"]')).toContainText(
      '12 of 10',
    )
    await expect(entry(page, 'over.example').locator('[data-usage="mailboxes"]')).toContainText(
      'Over the limit',
    )
    await page.goto('domains?q=zero.example')
    await expect(entry(page, 'zero.example').locator('[data-usage="mailboxes"]')).toContainText(
      '0 of 0',
    )
  })

  test('Edge: with 5,000 domains only one page is requested', async ({ page, mockApi }) => {
    await mockApi.use('domains-5000')
    await page.goto('domains')
    await listReady(page)
    expect(await resultCount(page)).toBe('Domains found: 5,000')
    const lists = (await mockApi.requests()).filter(
      (request) => request.operationId === 'listDomains',
    )
    expect(lists).toHaveLength(1)
    expect(lists[0]!.path).toContain('limit=25')
    expect(await entries(page).count()).toBe(25)
  })
})
