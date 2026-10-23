// UI 004 US1, the alias list (T031): paging, cards and table, search, filters, sort, address state,
// refresh, the list states, the badges and the edge cases.
import { ALIASES_60, LONG_VALUES_004 } from '../../mocks/scenarios/aliases-list'
import { expect, test } from '../fixtures/test'
import { entries, entry, entryIds, isNarrow, listReady, openFilters, pick } from './helpers'

test.describe('alias list', () => {
  test('US1-AS1 FR-005 the 25 newest of 60 as cards at 360 px, the total and the next page', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
    expectTouchTargets,
  }) => {
    await mockApi.use('aliases-60')
    await page.goto('aliases')
    await expect(page.getByRole('heading', { level: 1, name: 'Aliases' })).toBeVisible()
    await listReady(page)
    const ids = await entryIds(page)
    expect(ids).toHaveLength(25)
    expect(ids[0]).toBe(String(ALIASES_60.sales))
    expect(ids).toEqual([...ids].sort((a, b) => Number(b) - Number(a)))
    await expect(page.getByText('Showing 1 to 25 of 60 entries')).toBeVisible()
    if (isNarrow(page)) {
      await expect(page.getByRole('list', { name: 'Aliases' })).toBeVisible()
      await expectTouchTargets()
    }
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await expect(page).toHaveURL(/page=2/)
    await expect(page.getByText('Showing 26 to 50 of 60 entries')).toBeVisible()
    await page.getByLabel(/Show/).selectOption('50')
    await expect(page).toHaveURL(/size=50/)
    await expect(entries(page)).toHaveCount(50)
    await expectAccessible()
    await expectNoHorizontalScroll()
  })

  test('US1-AS2 US1-AS3 US1-AS4 FR-012 FR-017 the hint, the primary domain, special actions, "+10 more" and the badges', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('aliases-60')
    await page.goto('aliases')
    await listReady(page)
    await expect(
      page.getByText('Aliases are not applied on domain aliases automatically', { exact: false }),
    ).toBeVisible()
    await expect(entry(page, ALIASES_60.infoNet)).toContainText('example.net')
    await expect(entry(page, ALIASES_60.infoNet)).toContainText('Target domain: example.org')
    await expect(entry(page, ALIASES_60.learnSpam).locator('[data-special-action]')).toHaveText(
      'Learn as spam',
    )
    await expect(entry(page, ALIASES_60.discard).locator('[data-special-action]')).toHaveText(
      'Silently discard mail',
    )
    await expect(entry(page, ALIASES_60.twelve)).toContainText('+10 more')
    await expect(entry(page, ALIASES_60.catchAll).locator('[data-badge="catchAll"]')).toHaveText(
      'Catch-All',
    )
    await expect(entry(page, ALIASES_60.orphaned).locator('[data-badge="orphaned"]')).toBeVisible()
    await expect(entry(page, ALIASES_60.inactive).locator('[data-field="active"]')).toContainText(
      'No',
    )
    await expect(entry(page, ALIASES_60.internal).locator('[data-field="internal"]')).toContainText(
      'Yes',
    )
    if (!isNarrow(page)) {
      const table = page.getByRole('table')
      for (const header of ['Alias', 'Goto address', 'Domain', 'Internal', 'Active']) {
        await expect(table.getByRole('columnheader', { name: header, exact: true })).toBeVisible()
      }
    }
    await expectAccessible()
  })

  test('US1-AS5 FR-010 "INVOICE" finds exactly the three, the count is announced, and the search survives opening an alias', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('aliases-60')
    await page.goto('aliases')
    await listReady(page)
    await page.getByRole('searchbox', { name: 'Search:' }).fill('INVOICE')
    await expect.poll(() => entryIds(page)).toEqual(['48', '47', '46'])
    await expect(page.locator('[data-live="polite"]')).toHaveText('Showing 1 to 3 of 3 entries')
    await expect(page).toHaveURL(/q=INVOICE/)
    await entry(page, 48).press('Enter')
    await expect(page.getByRole('heading', { level: 1, name: 'Edit alias' })).toBeVisible()
    await page.goBack()
    await expect(page.getByRole('searchbox', { name: 'Search:' })).toHaveValue('INVOICE')
    await expect.poll(() => entryIds(page)).toEqual(['48', '47', '46'])
    await page.getByRole('button', { name: 'Clear search' }).click()
    await expect.poll(async () => (await entryIds(page)).length).toBe(25)
  })

  test('US1-AS6 FR-013 the delivers-to filter shows the three aliases of anna as a removable chip', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('aliases-60')
    await page.goto('aliases')
    await listReady(page)
    await openFilters(page)
    await pick(page, 'Goto address', 'anna', 'anna@example.org')
    await expect(page).toHaveURL(/destination=anna(@|%40)example\.org/)
    await expect.poll(() => entryIds(page)).toEqual(['60', '59', '58'])
    const chip = page.getByRole('button', { name: 'Remove filter: Goto address: anna@example.org' })
    await expect(chip).toBeVisible()
    await expectAccessible()
    await chip.click()
    await expect.poll(async () => (await entryIds(page)).length).toBe(25)
  })

  test('US1-AS7 FR-008 "nothing matches" offers to clear, and an empty server says so', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('aliases-60')
    await page.goto('aliases?q=nothing-like-this')
    await listReady(page)
    await expect(page.locator('[data-empty="noMatch"]')).toContainText('No matching records found')
    await page
      .locator('[data-empty="noMatch"]')
      .getByRole('button', { name: 'Clear all filters' })
      .click()
    await expect.poll(async () => (await entryIds(page)).length).toBe(25)
    await mockApi.use('aliases-empty')
    await page.goto('aliases')
    await listReady(page)
    await expect(page.locator('[data-empty="none"]')).toContainText('No data available in table')
    await expectAccessible()
  })

  test('US1-AS8 FR-008 FR-009 an unreachable API gives the error with retry, and refresh reloads', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('aliases-60')
    await page.route('**/api/v2/aliases?**', (route) => route.abort())
    await page.goto('aliases')
    await listReady(page)
    await expect(page.getByText('The list could not be loaded.')).toBeVisible()
    await expectAccessible()
    await page.unroute('**/api/v2/aliases?**')
    await page.getByRole('button', { name: 'Try again' }).click()
    await expect.poll(async () => (await entryIds(page)).length).toBe(25)
    const before = (await mockApi.requests()).filter((r) => r.operationId === 'listAliases').length
    await page.getByRole('button', { name: 'Refresh' }).click()
    await expect
      .poll(
        async () =>
          (await mockApi.requests()).filter((r) => r.operationId === 'listAliases').length,
      )
      .toBe(before + 1)
  })

  test('FR-006 reload, Back and a shared address restore the view', async ({ page, mockApi }) => {
    await mockApi.use('aliases-60')
    await page.goto('aliases?q=example.com&sort=address&order=desc&size=50')
    await listReady(page)
    const first = await entryIds(page)
    await page.reload()
    await listReady(page)
    expect(await entryIds(page)).toEqual(first)
    await page.goto('aliases')
    await listReady(page)
    await page.goBack()
    await expect(page.getByRole('searchbox', { name: 'Search:' })).toHaveValue('example.com')
    expect(await entryIds(page)).toEqual(first)
  })

  test('FR-007 FR-014 the table sorts from its headers with aria-sort, and cards from the sort control', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('aliases-60')
    await page.goto('aliases')
    await listReady(page)
    const keys = [
      'id',
      'address',
      'domain',
      'active',
      'groupwareVisible',
      'internal',
      'senderAllowed',
      'createdAt',
      'modifiedAt',
    ]
    if (isNarrow(page)) {
      for (const key of keys) {
        await page.getByLabel('Sort by').selectOption(key)
        if (key === 'id') await expect(page).not.toHaveURL(/sort=/)
        else await expect(page).toHaveURL(new RegExp(`sort=${key}`))
      }
      await page.getByLabel('Order').selectOption('desc')
      await expect(page).toHaveURL(/order=desc/)
    } else {
      const header = page.getByRole('columnheader', { name: 'Alias', exact: true })
      await expect(header).toHaveAttribute('aria-sort', 'none')
      await header.getByRole('button').click()
      await expect(page).toHaveURL(/sort=address/)
      await expect(header).toHaveAttribute('aria-sort', 'ascending')
      await header.getByRole('button').click()
      await expect(header).toHaveAttribute('aria-sort', 'descending')
      await expect(page.getByRole('columnheader', { name: /^Goto address/ })).not.toHaveAttribute(
        'aria-sort',
      )
    }
    const sorts = (await mockApi.requests())
      .filter((r) => r.operationId === 'listAliases')
      .map((r) => new URL(r.path, 'http://x').searchParams.get('sort'))
    expect(sorts).toContain('address')
  })

  test('FR-011 FR-013 each filter becomes its request parameter, and the domain picker searches the server', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('aliases-5000-domains')
    await page.goto('aliases')
    await listReady(page)
    await openFilters(page)
    await pick(page, 'Domain', 'example.n', 'example.net')
    await expect(page).toHaveURL(/domain=example\.net/)
    const pickerReads = (await mockApi.requests()).filter(
      (r) => r.operationId === 'listDomains' || r.operationId === 'listAliasDomains',
    )
    expect(pickerReads.length).toBeGreaterThan(0)
    for (const read of pickerReads) expect(read.path).toContain('limit=25')
    expect(pickerReads.some((read) => read.path.includes('q=example.n'))).toBe(true)
    await pick(page, 'Target domain', 'example.o', 'example.org')
    await page.getByRole('checkbox', { name: 'Catch-All' }).click()
    await expect(page.getByRole('checkbox', { name: 'Catch-All' })).toBeChecked()
    await page.getByRole('checkbox', { name: 'Learn as spam' }).click()
    await expect(page.getByRole('checkbox', { name: 'Learn as spam' })).toBeChecked()
    await page.getByLabel('Active', { exact: true }).selectOption('true')
    await page.getByLabel('Allow to send as this alias').selectOption('false')
    await page.getByLabel('Internal', { exact: true }).selectOption('false')
    await expect
      .poll(async () => {
        const last = (await mockApi.requests())
          .filter((r) => r.operationId === 'listAliases')
          .at(-1)!
        return new URL(last.path, 'http://x').searchParams.toString()
      })
      .toContain('internal=false')
    const last = (await mockApi.requests()).filter((r) => r.operationId === 'listAliases').at(-1)!
    const query = new URL(last.path, 'http://x').searchParams
    expect(query.getAll('domain')).toEqual(['example.net'])
    expect(query.getAll('primaryDomain')).toEqual(['example.org'])
    expect(query.getAll('kind')).toEqual(['catchAll'])
    expect(query.getAll('destinationType')).toEqual(['learnSpam'])
    expect(query.get('active')).toBe('true')
    expect(query.get('senderAllowed')).toBe('false')
    await expect(page.getByRole('button', { name: /^Filters \(7\)/ })).toBeVisible()
  })

  test('US2-AS11 FR-012 without the groupware there is no SOGo column, filter or sort key', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('aliases-groupware-disabled')
    await page.goto('aliases')
    await listReady(page)
    await openFilters(page)
    await expect(page.getByLabel('Alias is visible in SOGo')).toHaveCount(0)
    if (isNarrow(page)) {
      await expect(
        page.getByLabel('Sort by').locator('option[value="groupwareVisible"]'),
      ).toHaveCount(0)
      await expect(page.locator('[data-field="groupwareVisible"]')).toHaveCount(0)
    } else {
      await expect(page.getByRole('columnheader', { name: /SOGo/ })).toHaveCount(0)
    }
  })

  test('Edge: capabilities cannot be read, the list works without the groupware elements', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('capabilities-unavailable')
    await page.goto('aliases')
    await listReady(page)
    expect((await entryIds(page)).length).toBeGreaterThan(0)
    await expect(page.locator('[data-field="groupwareVisible"]')).toHaveCount(0)
    await expect(page.getByRole('columnheader', { name: /SOGo/ })).toHaveCount(0)
  })

  test('Edge: SC-004 long values, readable names and letter case need no horizontal scroll', async ({
    page,
    mockApi,
    expectNoHorizontalScroll,
  }) => {
    await mockApi.use('aliases-long-values')
    await page.goto('aliases')
    await listReady(page)
    await expect(entry(page, LONG_VALUES_004.idn)).toContainText('info@bücher.example')
    await expect(entry(page, LONG_VALUES_004.idn)).toContainText('info@xn--bcher-kva.example')
    await expect(entry(page, LONG_VALUES_004.mixedCase)).toContainText('Mixed.Case@example.org')
    await expectNoHorizontalScroll(page, { widths: [360, 320] })
  })
})
