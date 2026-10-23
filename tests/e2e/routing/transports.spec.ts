import { openBulkActions } from '../fixtures/flows'
import { clickRowAction } from '../fixtures/row-actions'
// UI 009 US3, Transport Maps (T054): the classic columns with the MX-based mark in text, search,
// filters and sort in the address, the add form with several destinations and one outcome each,
// the shared next hop credentials (inherited, refused when different, the other transports named
// after a change), interfering next hops, the edit form, deletion and bulk actions.
import { expect, test } from '../fixtures/test'
import { entry, entryIds, isNarrow, listReady, openFilters, polite, search } from './helpers'

test.describe('Transport Maps', () => {
  test('US3-AS1 FR-037 the classic columns as cards and a table, MX-based in text', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
    expectTouchTargets,
  }) => {
    await mockApi.use('routing-admin-default')
    await page.goto('routing/transports')
    await expect(page.getByRole('heading', { level: 1, name: 'Transport Maps' })).toBeVisible()
    await listReady(page)
    expect(await entryIds(page)).toEqual(['1', '2', '3', '4', '5'])
    await expect(entry(page, 1)).toContainText('[mx.partner.net]:25')
    await expect(entry(page, 1)).toContainText('u1')
    await expect(entry(page, 4)).toContainText('MX based')
    await expect(entry(page, 5)).toContainText('✕')
    if (!isNarrow(page)) {
      const table = page.getByRole('table')
      for (const header of ['ID', 'Destination', 'Next hop', 'Username', 'Active', 'Action']) {
        await expect(table.getByRole('columnheader', { name: header })).toBeVisible()
      }
    }
    await expect(page.locator('[data-screen-intro]')).toContainText('overrules')
    await expect(page.getByRole('navigation', { name: 'Routing' })).toBeVisible()
    await expectAccessible()
    await expectTouchTargets()
    await expectNoHorizontalScroll()
  })

  test('FR-038 search, filters and sort live in the address', async ({ page, mockApi }) => {
    await mockApi.use('routing-admin-default')
    await page.goto('routing/transports')
    await listReady(page)
    await search(page, 'partner')
    expect(await entryIds(page)).toEqual(['1', '2'])
    await openFilters(page)
    await page.getByLabel('Next hop', { exact: true }).fill('[MX.partner.net]:25')
    await page.getByLabel('Next hop', { exact: true }).press('Enter')
    await expect(page).toHaveURL(/nextHop=/)
    await page.getByLabel('Sort by').selectOption('destination')
    await page.getByLabel('Order').selectOption('desc')
    await page.reload()
    await listReady(page)
    expect(await entryIds(page)).toEqual(['2', '1'])
    await page.goto('routing/transports?mxBased=true')
    await listReady(page)
    expect(await entryIds(page)).toEqual(['4'])
  })

  test('FR-039 FR-040 US3-AS2 the add form takes several destinations and reports each', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
  }) => {
    await mockApi.use('routing-admin-default')
    await page.goto('routing/transports/new')
    await expect(page.getByRole('heading', { level: 1, name: 'Add transport' })).toBeVisible()
    await expect(page.getByLabel('Destination', { exact: true })).toHaveAttribute(
      'placeholder',
      /multiple values can be comma-separated/,
    )
    await expect(
      page.getByText('Adding a new transport map entry will update the credentials'),
    ).toBeVisible()
    await expect(page.getByLabel('Active', { exact: true })).not.toBeChecked()
    await expectAccessible()
    await expectNoHorizontalScroll()
    await page
      .getByLabel('Destination', { exact: true })
      .fill('one.example, two.example;three.example')
    await page.getByLabel('Next hop', { exact: true }).fill('[relay.partner.example]:25')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page).toHaveURL(/routing\/transports$/)
    await expect(polite(page)).toContainText(
      'Map entry one.example, two.example, three.example has been added',
    )
    const creations = (await mockApi.requests()).filter(
      (item) => item.operationId === 'createTransport',
    )
    expect(creations.map((item) => (item.body as { destination: string }).destination)).toEqual([
      'one.example',
      'two.example',
      'three.example',
    ])
    await listReady(page)
    expect(await entryIds(page)).toHaveLength(8)
  })

  test('US3-AS3 an invalid destination stays in the field with its reason, the others are created', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('routing-admin-default')
    await page.goto('routing/transports/new')
    await page.getByLabel('Destination', { exact: true }).fill('good.example bad_dest!! a.example')
    await page.getByLabel('Next hop', { exact: true }).fill('[relay.partner.example]:25')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    const results = page.getByRole('region', { name: 'Results' })
    await expect(results).toContainText('Map entry good.example has been added')
    await expect(results).toContainText('Destination format "bad_dest!!" is invalid')
    await expect(results).toContainText('Transport destination "a.example" exists')
    await expect(page.getByLabel('Destination', { exact: true })).toHaveValue(
      'bad_dest!! a.example',
    )
  })

  test('FR-041 US3-AS5 a different username for a shared next hop is refused with legacy’s message', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('routing-admin-default')
    await page.goto('routing/transports/new')
    await page.getByLabel('Destination', { exact: true }).fill('c.example')
    await page.getByLabel('Next hop', { exact: true }).fill('[mx.partner.net]:25')
    await page.getByLabel('Username').fill('u2')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.locator('#transport-add-username-error')).toContainText(
      'Next hop exists with different credentials, please update the existing credentials',
    )
  })

  test('US3-AS6 an interfering next hop is named', async ({ page, mockApi }) => {
    await mockApi.use('routing-admin-default')
    await page.goto('routing/transports/new')
    await page.getByLabel('Destination', { exact: true }).fill('d.example')
    await page.getByLabel('Next hop', { exact: true }).fill('[relay.net]:587')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.locator('#transport-add-nextHop-error')).toContainText(
      'relay.net interferes with nexthop [relay.net]:587',
    )
  })

  test('US3-AS4 FR-041 FR-042 a password change of a shared next hop names the other transports', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('routing-admin-default')
    await page.goto('routing/transports/1')
    await expect(page.getByRole('heading', { level: 1, name: 'Edit object' })).toBeVisible()
    await expect(page.getByLabel('Destination', { exact: true })).toHaveValue('a.example')
    await expect(page.getByText('A password is stored.')).toBeVisible()
    await expectAccessible()
    await page.getByLabel('Password').fill('Changed-Secret-2')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page).toHaveURL(/routing\/transports$/)
    await expect(polite(page)).toContainText(
      'The credentials of these transports changed too: b.example',
    )
    await expect(page.locator('body')).not.toContainText('Changed-Secret-2')
  })

  test('FR-042 FR-015 deletion with confirmation and bulk actions with per-entry results', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('routing-admin-default')
    await page.goto('routing/transports')
    await listReady(page)
    await clickRowAction(page, entry(page, 3), 'Remove: example.com')
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete now' }).click()
    await expect(entry(page, 3)).toHaveCount(0)
    await expect(polite(page)).toContainText('Map entry 3 has been removed')
    await page.getByRole('button', { name: 'Select', exact: true }).click()
    await entry(page, 5).getByRole('checkbox').check()
    await (
      await openBulkActions(page)
    )
      .getByRole('button', { name: 'Activate', exact: true })
      .click()
    await expect(page.getByRole('region', { name: 'Results' })).toContainText(
      'Changes to object * have been saved',
    )
  })

  test('Edge: a dropped connection during the batch reports that destination as unknown', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('routing-admin-default')
    await page.goto('routing/transports/new')
    await page.getByLabel('Destination', { exact: true }).fill('x1.example x2.example')
    await page.getByLabel('Next hop', { exact: true }).fill('[relay.partner.example]:25')
    let calls = 0
    await page.route('**/api/v2/transports', (route) => {
      if (route.request().method() !== 'POST') return route.continue()
      calls += 1
      return route.abort()
    })
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    const results = page.getByRole('region', { name: 'Results' })
    await expect(results).toContainText('Outcome unknown')
    await expect(results).toContainText('Not processed')
    expect(calls).toBe(1)
  })
})
