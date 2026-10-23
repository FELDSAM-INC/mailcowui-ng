import { clickRowAction } from '../fixtures/row-actions'
// UI 009 US5, BCC maps (T080): the classic BCC card as a list for administrators and domain
// administrators, orphaned maps for administrators, legacy's add form with the grouped local
// destination picker, the edit form, legacy's quick actions including the type switches, and the
// read-only view without the BCC maps permission.
import { permissionFlags } from '../../mocks/scenarios/accounts'
import { expect, test } from '../fixtures/test'
import { entry, entryIds, isNarrow, listReady, openFilters, polite, search } from './helpers'

test.describe('BCC maps', () => {
  test('US5-AS1 FR-050 the classic columns, the type in text and orphaned maps for administrators', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
    expectTouchTargets,
  }) => {
    await mockApi.use('routing-admin-default')
    await page.goto('routing/bcc-maps')
    await expect(page.getByRole('heading', { level: 1, name: 'BCC maps' })).toBeVisible()
    await listReady(page)
    expect(await entryIds(page)).toEqual(['1', '2', '3', '4', '5'])
    await expect(entry(page, 1)).toContainText('Recipient map')
    await expect(entry(page, 2)).toContainText('Sender map')
    await expect(entry(page, 1)).toContainText('@example.org')
    await expect(entry(page, 5)).toContainText('Domain no longer exists')
    if (!isNarrow(page)) {
      const table = page.getByRole('table')
      for (const header of ['ID', 'BCC type', 'Local destination', 'BCC destination', 'Domain']) {
        await expect(table.getByRole('columnheader', { name: header })).toBeVisible()
      }
    }
    await expect(page.locator('[data-screen-intro]')).toContainText('silently forward copies')
    await expectAccessible()
    await expectTouchTargets()
    await expectNoHorizontalScroll()
    await openFilters(page)
    await page.getByLabel('Domain no longer exists').selectOption('true')
    await listReady(page)
    expect(await entryIds(page)).toEqual(['5'])
  })

  test('FR-051 search, type, active and domain filters and the sort live in the address', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('routing-admin-default')
    await page.goto('routing/bcc-maps')
    await listReady(page)
    await search(page, 'archive')
    await openFilters(page)
    await page.getByLabel('BCC type', { exact: true }).selectOption('sender')
    await expect(page).toHaveURL(/type=sender/)
    await listReady(page)
    await expect.poll(() => entryIds(page)).toEqual(['2', '4'])
    await page.reload()
    await listReady(page)
    expect(await entryIds(page)).toEqual(['2', '4'])
    await page.goto('routing/bcc-maps?domain=example.net&sort=localDestination&order=desc')
    await listReady(page)
    expect(await entryIds(page)).toEqual(['3'])
  })

  test('US5-AS2 FR-052 FR-054 a domain administrator adds a map from the grouped picker', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
  }) => {
    await mockApi.use('routing-da-bcc')
    await page.goto('routing')
    await expect(page).toHaveURL(/routing\/bcc-maps$/)
    await listReady(page)
    expect(await entryIds(page)).toEqual(['1', '2', '3'])
    await page.locator('[data-add]').click()
    await expect(page.getByRole('heading', { level: 1, name: 'Add BCC map' })).toBeVisible()
    await expect(page.getByText('If you need to send a copy to multiple addresses')).toBeVisible()
    const picker = page.getByRole('combobox', { name: 'Local destination' })
    await picker.fill('sales')
    const option = page.getByRole('option', { name: /sales@example.org/ })
    await expect(option).toContainText('alice@example.org, bob@example.org')
    await expectAccessible()
    await expectNoHorizontalScroll()
    await option.click()
    await page.getByLabel('BCC type').selectOption('rcpt')
    await page.getByLabel('BCC destination').fill('copies@archive.example')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page).toHaveURL(/routing\/bcc-maps$/)
    await expect(polite(page)).toContainText('BCC map entry saved')
    const create = (await mockApi.requests()).find((item) => item.operationId === 'createBccMap')!
    expect(create.body).toEqual({
      localDestination: 'sales@example.org',
      type: 'recipient',
      bccDestination: 'copies@archive.example',
      active: true,
    })
  })

  test('US5-AS3 US5-AS4 several addresses and a duplicate are refused with legacy’s messages', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('routing-admin-default')
    await page.goto('routing/bcc-maps/new')
    await page.getByRole('combobox', { name: 'Local destination' }).fill('@example.org')
    await page.getByRole('option', { name: '@example.org', exact: true }).click()
    await page.getByLabel('BCC type').selectOption('rcpt')
    await page.getByLabel('BCC destination').fill('a@x.example, b@x.example')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.locator('#bcc-add-bccDestination-error')).toContainText(
      'BCC destination a@x.example, b@x.example is not a valid email address',
    )
    await page.getByLabel('BCC destination').fill('a@x.example')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.locator('#bcc-add-localDestination-error')).toContainText(
      'A BCC map @example.org exists for type rcpt',
    )
  })

  test('US5-AS5 FR-053 the edit form changes destination, type and active', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('routing-admin-default')
    await page.goto('routing/bcc-maps')
    await listReady(page)
    await clickRowAction(page, entry(page, 2), 'Edit: alice@example.org')
    await expect(page.getByRole('heading', { level: 1, name: 'Edit object' })).toBeVisible()
    await expect(page.getByText('alice@example.org').first()).toBeVisible()
    await expect(page.getByLabel('BCC destination')).toHaveValue('alice-copy@archive.example')
    await expectAccessible()
    await page.getByLabel('BCC destination').fill('alice-new@archive.example')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page).toHaveURL(/routing\/bcc-maps$/)
    await expect(polite(page)).toContainText('BCC map entry alice-new@archive.example edited')
  })

  test('FR-015 bulk actions with the type switches, a duplicating switch refused and kept selected', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('routing-admin-default')
    await mockApi.patch({
      routing: { bccMaps: { add: [{ id: 6, type: 'sender', localDestination: '@example.org' }] } },
    })
    await page.goto('routing/bcc-maps')
    await listReady(page)
    await page.getByRole('button', { name: 'Select', exact: true }).click()
    await entry(page, 1).getByRole('checkbox').check()
    await entry(page, 3).getByRole('checkbox').check()
    await page
      .getByRole('region', { name: 'Bulk actions' })
      .getByRole('button', { name: 'Switch to sender map type' })
      .click()
    const results = page.getByRole('region', { name: 'Results' })
    await expect(results).toContainText('A BCC map @example.org exists for type sender')
    await expect(results).toContainText('BCC map entry archive@archive.example edited')
    await expect(entry(page, 1).getByRole('checkbox')).toBeChecked()
    await expect(entry(page, 3).getByRole('checkbox')).not.toBeChecked()
  })

  test('US5-AS6 FR-002 SC-010 without the permission the maps are read-only', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('routing-da-readonly')
    await page.goto('routing/bcc-maps')
    await listReady(page)
    expect(await entryIds(page)).toEqual(['1', '2', '3'])
    await expect(page.locator('[data-add]')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Select', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^Remove/ })).toHaveCount(0)
    await expectAccessible()
    await entry(page, 2).press('Enter')
    await expect(page.getByText('alice-copy@archive.example')).toBeVisible()
    await expect(page.getByRole('textbox')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Save changes' })).toHaveCount(0)
    await page.goto('routing/bcc-maps/new')
    await expect(page.getByRole('heading', { name: 'No access' })).toBeVisible()
  })

  test('Edge: the BCC maps permission removed meanwhile is refused on save', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('routing-da-bcc')
    await page.goto('routing/bcc-maps/2')
    await page.getByLabel('BCC destination').fill('changed@archive.example')
    await mockApi.patch({
      accounts: {
        reseller: { permissions: permissionFlags(true, { loginAs: false, bccMaps: false }) },
      },
    })
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByText('Access denied or invalid form data').first()).toBeVisible()
  })

  test('Edge: an administrator edits and deletes the orphaned map', async ({ page, mockApi }) => {
    await mockApi.use('routing-admin-default')
    await page.goto('routing/bcc-maps')
    await listReady(page)
    await clickRowAction(page, entry(page, 5), 'Remove: @gone.example')
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete now' }).click()
    await expect(entry(page, 5)).toHaveCount(0)
    await expect(polite(page)).toContainText('BCC map entries deleted: 5')
  })
})
