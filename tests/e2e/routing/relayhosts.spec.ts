import { openBulkActions } from '../fixtures/flows'
import { clickRowAction } from '../fixtures/row-actions'
// UI 009 US1, Sender-dependent transports (T027): the classic list's columns as cards and a table,
// the hint, search, filters, sort and paging in the address, the add and edit forms with
// write-only passwords, deletion with the usage as impact, bulk actions with per-entry results,
// outdated saves and the edge cases.
import { expect, test } from '../fixtures/test'
import { assertiveRegion } from '../fixtures/flows'
import { entry, entryIds, isNarrow, listReady, openFilters, polite, search } from './helpers'

test.describe('Sender-dependent transports', () => {
  test('US1-AS1 FR-005 FR-019 the classic columns as cards at 360 px and a table on desktop', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
    expectTouchTargets,
  }) => {
    await mockApi.use('routing-admin-default')
    await page.goto('routing/relayhosts')
    await expect(
      page.getByRole('heading', { level: 1, name: 'Sender-dependent transports' }),
    ).toBeVisible()
    await listReady(page)
    expect(await entryIds(page)).toEqual(['1', '2', '3', '4', '5'])
    const two = entry(page, 2)
    await expect(two).toContainText('relay.example.com')
    await expect(two).toContainText('Domains: 2')
    await expect(two).toContainText('Mailboxes: 3')
    await expect(entry(page, 1)).toContainText('relay-user')
    await expect(entry(page, 3)).toContainText('✕')
    if (isNarrow(page)) {
      await expect(page.getByRole('list', { name: 'Sender-dependent transports' })).toBeVisible()
      await expect(two).toContainText('ID:')
    } else {
      const table = page.getByRole('table')
      for (const header of ['ID', 'Host', 'Username', 'In use by', 'Active', 'Action']) {
        await expect(table.getByRole('columnheader', { name: header })).toBeVisible()
      }
    }
    await expect(page.locator('[data-screen-intro]')).toContainText('sender-dependent transports')
    await expect(page.getByRole('navigation', { name: 'Routing' })).toBeVisible()
    await expect(page.locator('body')).not.toContainText('Relay-Secret-1')
    await expectAccessible()
    await expectTouchTargets()
    await expectNoHorizontalScroll()
  })

  test('US1-AS2 FR-006 the empty list offers the add action, no match offers to clear', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('routing-admin-empty')
    await page.goto('routing/relayhosts')
    await listReady(page)
    const empty = page.locator('[data-empty]')
    await expect(empty).toContainText('No data available in table')
    await expect(empty.getByRole('link', { name: 'Add sender-dependent transport' })).toBeVisible()
    await expectAccessible()
    await mockApi.use('routing-admin-default')
    await page.goto('routing/relayhosts?q=nothing-matches')
    await listReady(page)
    await expect(page.locator('[data-no-matches]')).toContainText('No matching records found')
    await page.getByRole('button', { name: 'Clear all filters' }).first().click()
    await expect(page).not.toHaveURL(/q=/)
    expect(await entryIds(page)).toHaveLength(5)
  })

  test('FR-007 FR-020 search, filters, sort and page size live in the address and survive a reload', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('routing-admin-default')
    await page.goto('routing/relayhosts')
    await listReady(page)
    await search(page, 'smarthost')
    expect(await entryIds(page)).toEqual(['4', '5'])
    await expect(polite(page)).toContainText('Showing 1 to 2 of 2 entries')
    await openFilters(page)
    await page.getByLabel('Active', { exact: true }).selectOption('true')
    await page.getByLabel('Sort by').selectOption('username')
    await page.getByLabel('Order').selectOption('desc')
    await expect(page).toHaveURL(/active=true/)
    await expect(page).toHaveURL(/sort=username/)
    await expect(page).toHaveURL(/order=desc/)
    await page.reload()
    await listReady(page)
    expect(await entryIds(page)).toEqual(['5', '4'])
    await expect(page.getByRole('button', { name: /Remove filter: Active/ })).toBeVisible()
    await page.goto('routing/relayhosts?inUse=true')
    await listReady(page)
    expect(await entryIds(page)).toEqual(['2'])
  })

  test('US1-AS3 FR-011 FR-021 adds a relayhost with credentials on its own page', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
  }) => {
    await mockApi.use('routing-admin-empty')
    await page.goto('routing/relayhosts')
    await listReady(page)
    await page.locator('[data-add]').click()
    await expect(
      page.getByRole('heading', { level: 1, name: 'Add sender-dependent transport' }),
    ).toBeVisible()
    await expect(
      page.getByText('authentication data, if any, will be stored as plain text'),
    ).toBeVisible()
    await expect(page.getByLabel('Host', { exact: true })).toHaveAttribute(
      'placeholder',
      '[0.0.0.0], [0.0.0.0]:25, host:25, host, [host]:25',
    )
    await expectAccessible()
    await expectNoHorizontalScroll()
    await page.getByLabel('Host', { exact: true }).fill('[smtp.example.net]:587')
    await page.getByLabel('Username').fill('relay-user')
    await page.getByLabel('Password').fill('Typed-Secret-9')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page).toHaveURL(/routing\/relayhosts$/)
    await expect(polite(page)).toContainText('Map entry [smtp.example.net]:587 has been added')
    await expect(entry(page, 1)).toContainText('[smtp.example.net]:587')
    const requests = await mockApi.requests()
    const create = requests.find((item) => item.operationId === 'createRelayhost')!
    expect(create.body).toEqual({
      host: '[smtp.example.net]:587',
      username: 'relay-user',
      password: '[redacted]',
    })
    await expect(page.locator('body')).not.toContainText('Typed-Secret-9')
  })

  test('US1-AS8 FR-013 an invalid host is refused at the field, the password is emptied', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('routing-admin-empty')
    await page.goto('routing/relayhosts/new')
    await page.getByLabel('Host', { exact: true }).fill('not a host!')
    await page.getByLabel('Username').fill('someone')
    await page.getByLabel('Password').fill('Typed-Secret-9')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.getByText('Invalid host specified: not a host!')).toBeVisible()
    await expect(page.getByLabel('Username')).toHaveValue('someone')
    await expect(page.getByLabel('Password')).toHaveValue('')
    await expect(page.getByLabel('Host', { exact: true })).toBeFocused()
  })

  test('Edge: a password without a username is refused at the username', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('routing-admin-empty')
    await page.goto('routing/relayhosts/new')
    await page.getByLabel('Host', { exact: true }).fill('relay.example.org')
    await page.getByLabel('Password').fill('Typed-Secret-9')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.getByText('A username is needed for a password.')).toBeVisible()
  })

  test('US1-AS5 US1-AS6 FR-026 FR-027 the stored password is kept, removed, and goes with the username', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('routing-admin-default')
    await page.goto('routing/relayhosts/1')
    await expect(page.getByRole('heading', { level: 1, name: 'Edit object' })).toBeVisible()
    const password = page.getByLabel('Password')
    await expect(password).toHaveValue('')
    await expect(password).toHaveAttribute('placeholder', 'If unchanged leave blank')
    await expect(password).toHaveAttribute('autocomplete', 'new-password')
    await expect(page.getByText('A password is stored.')).toBeVisible()
    await expect(page.getByText('Please do not use TLS-wrapped ports')).toBeVisible()
    await expectAccessible()
    await page.getByLabel('Host', { exact: true }).fill('[smtp.example.net]:2525')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page).toHaveURL(/routing\/relayhosts$/)
    await expect(polite(page)).toContainText(
      'Changes to object [smtp.example.net]:2525 have been saved',
    )
    const update = (await mockApi.requests()).find(
      (item) => item.operationId === 'updateRelayhost',
    )!
    expect(update.body).toEqual({ host: '[smtp.example.net]:2525' })
    expect(update.headers['if-match']).toBeTruthy()

    await page.goto('routing/relayhosts/1')
    await page.getByRole('button', { name: 'Remove password' }).click()
    await expect(page.getByText('The password will be removed when you save.')).toBeVisible()
    await page.getByRole('button', { name: 'Undo' }).click()
    await page.getByRole('button', { name: 'Remove password' }).click()
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page).toHaveURL(/routing\/relayhosts$/)
    await page.goto('routing/relayhosts/1')
    await expect(page.getByText('No password is stored.')).toBeVisible()

    await page.goto('routing/relayhosts/4')
    await page.getByLabel('Username').fill('')
    await expect(
      page.getByText('Saving without a username also removes the stored password.'),
    ).toBeVisible()
  })

  test('US1-AS7 FR-017 FR-018 deleting a relayhost names its domains and mailboxes', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('routing-admin-default')
    await page.goto('routing/relayhosts')
    await listReady(page)
    await clickRowAction(page, entry(page, 2), 'Remove: relay.example.com')
    const dialog = page.getByRole('alertdialog', { name: 'Confirm deletion' })
    await expect(dialog).toContainText('example.org')
    await expect(dialog).toContainText('example.net')
    await expect(dialog).toContainText('alice@example.org')
    await expect(dialog).toContainText('carol@example.net')
    await expect(dialog).toContainText('None / Inherit')
    await expect(dialog.getByRole('link', { name: 'Show all' })).toBeVisible()
    await expectAccessible()
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(entry(page, 2)).toBeVisible()
    await clickRowAction(page, entry(page, 2), 'Remove: relay.example.com')
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete now' }).click()
    await expect(entry(page, 2)).toHaveCount(0)
    await expect(polite(page)).toContainText('Map entry 2 has been removed')
  })

  test('FR-015 FR-016 bulk deactivation and deletion with per-entry results', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('routing-admin-default')
    await page.goto('routing/relayhosts')
    await listReady(page)
    await page.getByRole('button', { name: 'Select', exact: true }).click()
    await page.getByRole('checkbox', { name: 'Select relay.example.com' }).check()
    await page.getByRole('checkbox', { name: 'Select [smarthost.example]:587 (alpha)' }).check()
    await mockApi.patch({ routing: { relayhosts: { set: { '4': { username: 'changed' } } } } })
    await (await openBulkActions(page)).getByRole('button', { name: 'Deactivate' }).click()
    const summary = page.getByRole('region', { name: 'Results' })
    await expect(summary).toContainText('Changes to object relay.example.com have been saved')
    await expect(summary).toContainText('Changed in the meantime')
    await expectAccessible()
    await expect(entry(page, 4).getByRole('checkbox')).toBeChecked()
    await expect(entry(page, 2).getByRole('checkbox')).not.toBeChecked()
    await summary.getByRole('button', { name: 'Close' }).click()
    await entry(page, 4).getByRole('checkbox').uncheck()
    await page.getByRole('checkbox', { name: 'Select [old-relay.example.org]:25' }).check()
    await (await openBulkActions(page)).getByRole('button', { name: 'Remove' }).click()
    const dialog = page.getByRole('alertdialog', { name: 'Confirm deletion' })
    await expect(dialog.getByRole('button', { name: 'Delete now' })).toBeDisabled()
    await dialog.getByLabel('Type 1 to confirm').fill('1')
    await dialog.getByRole('button', { name: 'Delete now' }).click()
    await expect(page.getByRole('region', { name: 'Results' })).toContainText(
      'Map entry 3 has been removed',
    )
    await expect(entry(page, 3)).toHaveCount(0)
  })

  test('Edge: a dropped connection reports the outcome as unknown and retries nothing', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('routing-admin-default')
    await page.goto('routing/relayhosts')
    await listReady(page)
    await page.getByRole('button', { name: 'Select', exact: true }).click()
    await page.getByRole('checkbox', { name: 'Select relay.example.com' }).check()
    let calls = 0
    await page.route('**/api/v2/relayhosts/bulk-actions', (route) => {
      calls += 1
      return route.abort()
    })
    await (
      await openBulkActions(page)
    )
      .getByRole('button', { name: 'Activate', exact: true })
      .click()
    await expect(page.getByRole('region', { name: 'Results' })).toContainText('Outcome unknown')
    expect(calls).toBe(1)
  })

  test('Edge: the selection stops at the server bulk limit and says so', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('routing-bulk-limit-10')
    await page.goto('routing/relayhosts')
    await listReady(page)
    await page.getByRole('button', { name: 'Select', exact: true }).click()
    await page.getByRole('checkbox', { name: 'Select all on this page' }).check()
    const bar = page.getByRole('region', { name: 'Bulk actions' })
    await expect(bar).toContainText('10 selected')
    await expect(bar).toContainText('You can select at most 10 items for one action.')
    await expect(page.getByRole('checkbox', { name: /Select \[relay011/ })).toBeDisabled()
  })

  test('Edge: an outdated save keeps the input, names the change and saves again', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('routing-admin-default')
    await page.goto('routing/relayhosts/2')
    await page.getByLabel('Username').fill('new-user')
    await mockApi.patch({
      routing: { relayhosts: { set: { '2': { host: 'relay2.example.com' } } } },
    })
    await page.getByRole('button', { name: 'Save changes' }).click()
    const notice = page.locator('[data-outdated]')
    await expect(notice).toContainText('Host: now saved as relay2.example.com')
    await expect(page.getByLabel('Username')).toHaveValue('new-user')
    await notice.getByRole('button', { name: 'Save again' }).click()
    await expect(page).toHaveURL(/routing\/relayhosts$/)
  })

  test('FR-012 leaving the edit form with changes asks first', async ({ page, mockApi }) => {
    await mockApi.use('routing-admin-default')
    await page.goto('routing/relayhosts')
    await listReady(page)
    await clickRowAction(page, entry(page, 2), 'Edit: relay.example.com')
    await page.getByLabel('Username').fill('typed')
    await page.getByRole('link', { name: 'Previous page' }).click()
    const dialog = page.getByRole('alertdialog', { name: 'Leave without saving?' })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Stay' }).click()
    await expect(page.getByLabel('Username')).toHaveValue('typed')
  })

  test('Edge: an entry deleted elsewhere shows "not found" with the way back', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('routing-admin-default')
    await page.goto('routing/relayhosts/77')
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
    await page.getByRole('link', { name: 'Back to the list' }).click()
    await expect(page).toHaveURL(/routing\/relayhosts$/)
  })

  test('FR-067 an undocumented error on save shows the generic message with the request ID', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('routing-admin-default')
    await page.goto('routing/relayhosts/2')
    await page.getByLabel('Username').fill('someone')
    await mockApi.failNext('updateRelayhost', { status: 500 })
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByText(/Request ID/)).toBeVisible()
    await expect(page.getByLabel('Username')).toHaveValue('someone')
    await expect(assertiveRegion(page)).not.toBeEmpty()
  })

  test('FR-002 FR-003 a domain administrator gets "no access" and no request', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('routing-da-bcc')
    await page.goto('routing/relayhosts')
    await expect(page.getByRole('heading', { name: 'No access' })).toBeVisible()
    const requests = await mockApi.requests()
    expect(requests.some((item) => item.operationId === 'listRelayhosts')).toBe(false)
  })
})
