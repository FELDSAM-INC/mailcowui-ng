// UI 003 US1, the mailbox list (T050), the classic "Mailboxes" tab: paging, cards and legacy's
// table with the column chooser, the search in the address with Back, filters with chips, sort,
// the list states, roles, markup shown as text, IDN names and long values.
import type { Page } from '@playwright/test'

import { entries, entry, entryNames, isNarrow, listReady, openFilters } from '../domains/helpers'
import { expect, test } from '../fixtures/test'
import { rowAction } from '../fixtures/row-actions'

async function open(page: Page, query = '') {
  await page.goto(`mailboxes${query}`)
  await expect(page.getByRole('heading', { level: 1, name: 'Mailboxes' })).toBeVisible()
  await listReady(page)
}

async function search(page: Page, text: string) {
  await page.getByRole('searchbox', { name: 'Search:' }).fill(text)
}

async function listRequests(mockApi: {
  requests(): Promise<{ operationId: string | null; path: string }[]>
}) {
  return (await mockApi.requests()).filter((request) => request.operationId === 'listMailboxes')
}

test.describe('mailbox list', () => {
  test('US1-AS1 FR-007 FR-013 the first 25 of 30 sorted by address, with paging and each entry opening its mailbox', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
    expectTouchTargets,
  }) => {
    await mockApi.use('admin-mailboxes-30')
    await open(page)
    const names = await entryNames(page)
    expect(names).toHaveLength(25)
    expect(names).toEqual([...names].sort())
    expect(names[0]).toBe('anna@a.example')
    await expect(page.getByText('Showing 1 to 25 of 30 entries')).toBeVisible()
    const anna = entry(page, 'anna@a.example')
    await expect(await rowAction(page, anna, 'Edit anna@a.example')).toBeVisible()
    await page.keyboard.press('Escape')
    if (isNarrow(page)) {
      await expect(anna.getByRole('heading', { name: 'anna@a.example' })).toBeVisible()
      await expect(anna).toContainText('Anna Smith')
      await expect(anna).toContainText('Active')
      await expect(anna).toContainText('512 MiB/2 GiB')
      await expect(anna).toContainText('1,200')
      await expectTouchTargets()
    } else {
      const headers = await page.locator('thead th').allTextContents()
      expect(headers.map((text) => text.replace(/[▲▼]/g, '').trim())).toEqual([
        'Username',
        'Quota',
        'Last mail login',
        'In use (%)',
        'Message #',
        'Active',
        'Action',
      ])
      await expect(anna.locator('[data-cell="lastMailLogin"]')).toContainText('IMAP @')
    }
    await expectAccessible()
    await expectNoHorizontalScroll()
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await expect(page).toHaveURL(/page=2/)
    await expect(entries(page)).toHaveCount(5)
    await page.getByRole('button', { name: 'Previous', exact: true }).click()
    await entry(page, 'anna@a.example')
      .getByRole('link', { name: 'anna@a.example', exact: true })
      .click()
    await expect(page).toHaveURL(/\/ng\/mailboxes\/anna@a\.example$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Edit mailbox' })).toBeVisible()
  })

  test('US1-AS2 FR-008 an optional column chosen on desktop survives a reload', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    test.skip(isNarrow(page), 'columns are the wide layout')
    await mockApi.use('admin-mailboxes-30')
    await open(page)
    await page.getByRole('button', { name: 'Columns' }).click()
    await page.getByRole('menuitemcheckbox', { name: 'Created on' }).click()
    await page.getByRole('menuitemcheckbox', { name: 'IMAP' }).click()
    await page.keyboard.press('Escape')
    await expect(page.locator('thead th[data-column="createdAt"]')).toBeVisible()
    await expectAccessible()
    await page.reload()
    await listReady(page)
    await expect(page.locator('thead th[data-column="createdAt"]')).toBeVisible()
    await expect(page.locator('thead th[data-column="imap"]')).toHaveText('IMAP')
    expect(await page.evaluate(() => localStorage.getItem('mailcowui-ng.mailboxes.columns'))).toBe(
      '["imap","createdAt"]',
    )
  })

  test('FR-008 Columns keeps its last option reachable in short landscape viewports', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    // Three viewport states retain the full palette/theme accessibility scan.
    test.setTimeout(90_000)
    await mockApi.use('admin-mailboxes-30')
    await page.setViewportSize({ width: 1366, height: 900 })
    await open(page)
    const trigger = page.getByRole('button', { name: 'Columns', exact: true })
    for (const viewport of [
      { width: 1366, height: 900 },
      { width: 780, height: 360 },
      { width: 780, height: 225 },
    ]) {
      await page.setViewportSize(viewport)
      await trigger.click()
      const menu = page.getByRole('menu')
      const last = menu.getByRole('menuitemcheckbox', { name: 'Tags', exact: true })
      await page.keyboard.press('End')
      await expect(last).toBeFocused()
      await expect(last).toBeInViewport({ ratio: 1 })
      const bounds = await menu.boundingBox()
      expect(bounds).not.toBeNull()
      expect(bounds!.y).toBeGreaterThanOrEqual(-1)
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height + 1)
      const checked = await last.getAttribute('aria-checked')
      await page.keyboard.press('Space')
      await expect(last).toHaveAttribute('aria-checked', checked === 'true' ? 'false' : 'true')
      await expectAccessible()
      await page.keyboard.press('Escape')
      await expect(trigger).toBeFocused()
    }
  })

  test('US1-AS3 FR-009 "ANNA" finds three, in the address, as a new history entry that Back undoes', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('admin-mailboxes-30')
    await open(page)
    await search(page, 'ANNA')
    await expect(page).toHaveURL(/[?&]q=ANNA/)
    await expect(entries(page)).toHaveCount(3)
    expect(await entryNames(page)).toEqual(['anna@a.example', 'bob@a.example', 'carl@a.example'])
    await page.goBack()
    await expect(page).not.toHaveURL(/q=/)
    await expect(entries(page)).toHaveCount(25)
    await expect(page.getByRole('searchbox', { name: 'Search:' })).toHaveValue('')
  })

  test('Edge: search text with special characters is sent literally', async ({ page, mockApi }) => {
    await mockApi.use('admin-mailboxes-30')
    await open(page)
    await search(page, '50%_&x')
    await expect(page.locator('[data-empty="noMatch"]')).toBeVisible()
    const last = (await listRequests(mockApi)).at(-1)!
    expect(new URL(last.path, 'http://x').searchParams.get('q')).toBe('50%_&x')
  })

  test('US1-AS4 US1-AS5 FR-071 domain and status filters as removable chips, no match and clear all', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
  }) => {
    await mockApi.use('admin-mailboxes-30')
    await open(page)
    await openFilters(page)
    const panel = page.locator('#mailbox-filters')
    await panel.getByRole('checkbox', { name: 'Inactive' }).check()
    await expect(page).toHaveURL(/status=inactive/)
    await expect(entries(page)).toHaveCount(1)
    await panel.getByRole('combobox', { name: 'Domain' }).fill('b.example')
    await page.getByRole('option', { name: 'b.example' }).click()
    await page.keyboard.press('Escape')
    await expect(page).toHaveURL(/domain=b\.example/)
    await expect(page.locator('[data-empty="noMatch"]')).toBeVisible()
    await expect(page.getByText('No matching records found')).toBeVisible()
    const chips = page.getByRole('region', { name: 'Active filters' })
    await expect(
      chips.getByRole('button', { name: 'Remove filter: Domain: b.example' }),
    ).toBeVisible()
    await expectAccessible()
    await expectNoHorizontalScroll()
    await chips.getByRole('button', { name: 'Remove filter: Domain: b.example' }).click()
    await expect(entries(page)).toHaveCount(1)
    await expect(entry(page, 'gina@a.example')).toBeVisible()
    await chips.getByRole('button', { name: 'Clear all filters' }).click()
    await expect(page).not.toHaveURL(/status=/)
    await expect(entries(page)).toHaveCount(25)
  })

  test('US1-AS6 US1-AS7 FR-010 the fullest first with a critical bar, unlimited last without a bar', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('admin-mailboxes-30')
    await open(page)
    if (isNarrow(page)) {
      await openFilters(page)
      await page.getByLabel('Sort by').selectOption('percentUsed')
      await page.getByLabel('Order').selectOption('desc')
    } else {
      const header = page.locator('thead th[data-column="inUse"]')
      await header.getByRole('button').click()
      await expect(header).toHaveAttribute('aria-sort', 'ascending')
      await header.getByRole('button').click()
      await expect(header).toHaveAttribute('aria-sort', 'descending')
    }
    await expect(page).toHaveURL(/sort=percentUsed/)
    await expect(page).toHaveURL(/order=desc/)
    await expect(entries(page).first()).toHaveAttribute('data-entry', 'bob@a.example')
    const bob = entry(page, 'bob@a.example')
    await expect(bob.locator('[data-in-use="danger"]')).toContainText('92%')
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    const last = entries(page).last()
    await expect(last.locator('[data-in-use="none"]')).toHaveText('-')
    await expect(last).toContainText('∞')
  })

  test('US1-AS7 sizes and percentages in Czech', async ({ page, mockApi }) => {
    await mockApi.use('admin-mailboxes-30', {
      accounts: { admin: { preferences: { language: 'cs-cz', theme: 'light', etag: '"p2"' } } },
    })
    await page.goto('mailboxes?q=bob')
    await listReady(page)
    await expect(entry(page, 'bob@a.example').locator('[data-in-use="danger"]')).toContainText(
      '92 %',
    )
  })

  test('US1-AS10 FR-065 the error state with retry', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('mailboxes-list-error')
    await page.goto('mailboxes')
    await expect(page.locator('[data-list-state="error"]')).toBeVisible({ timeout: 15_000 })
    await expectAccessible()
    await mockApi.patch({ failures: { listMailboxes: { status: 500, times: 0 } } })
    await page.getByRole('button', { name: 'Try again' }).click()
    await expect(entries(page)).toHaveCount(25)
  })

  test('FR-065 an empty server explains itself', async ({ page, mockApi }) => {
    await mockApi.use('mailboxes-empty-filter')
    await open(page)
    await expect(page.locator('[data-empty="none"]')).toContainText('No data available in table')
  })

  test('US1-AS11 FR-001 a mailbox user has no entry and no access; a domain administrator sees only their domain', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('mailbox-user-active')
    await page.goto('mailboxes')
    await expect(page.getByRole('heading', { level: 1, name: 'Mailboxes' })).toHaveCount(0)
    await expect(page.locator('[data-list-state]')).toHaveCount(0)
    await mockApi.use('domain-admin-mailboxes')
    await open(page)
    const names = await entryNames(page)
    expect(names.every((name) => name.endsWith('@a.example'))).toBe(true)
  })

  test('FR-075 markup in display names and tags is shown as text; IDN domains are readable', async ({
    page,
    mockApi,
  }) => {
    let dialogs = 0
    page.on('dialog', (dialog) => {
      dialogs += 1
      void dialog.dismiss()
    })
    await mockApi.use('admin-mailboxes-30')
    if (!isNarrow(page)) {
      await page.addInitScript(() =>
        localStorage.setItem('mailcowui-ng.mailboxes.columns', '["displayName","tags"]'),
      )
    }
    await open(page, '?q=markup')
    const row = entry(page, 'markup@b.example')
    await expect(row).toContainText('<b>Bold</b>')
    if (!isNarrow(page)) await expect(row).toContainText('<img src=x onerror=alert(1)>')
    await expect(row.locator('b, img')).toHaveCount(0)
    expect(dialogs).toBe(0)
    await search(page, 'jana')
    await expect(entry(page, 'jana@xn--bcher-kva.example')).toContainText('jana@bücher.example')
  })

  test('FR-006 page sizes are kept in the address and not in storage', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('admin-mailboxes-30')
    await open(page)
    await page.locator('[data-page-size] select').selectOption('50')
    await expect(page).toHaveURL(/size=50/)
    await expect(entries(page)).toHaveCount(30)
    const stored = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))
    expect(stored).not.toContain('50')
  })

  test('FR-014 refresh shows a mailbox added elsewhere', async ({ page, mockApi }) => {
    await mockApi.use('admin-mailboxes-30')
    await open(page, '?q=zoe')
    await expect(page.locator('[data-empty="noMatch"]')).toBeVisible()
    await mockApi.patch({ mailboxes: { add: [{ localPart: 'zoe', domain: 'a.example' }] } })
    await page.getByRole('button', { name: 'Refresh' }).click()
    await expect(entry(page, 'zoe@a.example')).toBeVisible()
  })

  test('Edge: last logins not reported leave out the column', async ({ page, mockApi }) => {
    test.skip(isNarrow(page), 'the column is the wide layout')
    await mockApi.use('capabilities-last-logins-off')
    await open(page)
    await expect(page.locator('thead th[data-column="address"]')).toBeVisible()
    await expect(page.locator('thead th[data-column="lastMailLogin"]')).toHaveCount(0)
  })

  test('Edge: long values wrap at 360 and 320 px', async ({
    page,
    mockApi,
    expectNoHorizontalScroll,
  }) => {
    test.skip(!isNarrow(page), 'phone widths')
    await mockApi.use('admin-mailboxes-30')
    for (const width of [360, 320]) {
      await page.setViewportSize({ width, height: 780 })
      await open(page, '?q=long')
      await expect(entry(page, 'long@b.example')).toContainText('NNNN')
      await expectNoHorizontalScroll()
    }
  })

  test('SC-001 on a phone, find a mailbox among 10,000 and open it in under 10 s', async ({
    page,
    mockApi,
  }) => {
    test.skip(!isNarrow(page), 'phone width')
    await mockApi.use('admin-mailboxes-10k')
    const started = Date.now()
    await open(page)
    await search(page, 'domain250')
    await expect(page).toHaveURL(/q=domain250/)
    const first = entries(page).first()
    await expect(first).toBeVisible()
    const address = (await first.getAttribute('data-entry'))!
    expect(address).toContain('@domain250.example')
    await first.getByRole('link', { name: address, exact: true }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Edit mailbox' })).toBeVisible()
    expect(Date.now() - started).toBeLessThan(10_000)
  })
})
