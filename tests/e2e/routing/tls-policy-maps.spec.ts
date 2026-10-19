// UI 009 US6, TLS policy maps (T090): the classic columns, search, the several-policy and active
// filters, legacy's add and edit forms with the raw policy values, refusals with legacy's messages
// at their fields, deletion and bulk actions.
import { expect, test } from '../fixtures/test'
import { entry, entryIds, isNarrow, listReady, openFilters, polite } from './helpers'

test.describe('TLS policy maps', () => {
  test('US6-AS1 FR-057 the classic columns, a dash for empty parameters, and the filters', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
    expectTouchTargets,
  }) => {
    await mockApi.use('routing-admin-default')
    await page.goto('routing/tls-policy-maps')
    await expect(
      page.getByRole('heading', { level: 1, name: 'Outgoing TLS policy map overrides' }),
    ).toBeVisible()
    await listReady(page)
    expect(await entryIds(page)).toHaveLength(8)
    await expect(entry(page, 1)).toContainText('none.example')
    await expect(entry(page, 1)).toContainText('-')
    await expect(entry(page, 5)).toContainText('dane-only')
    await expect(entry(page, 5)).toContainText('protocols=!SSLv2 ciphers=medium')
    if (!isNarrow(page)) {
      for (const header of ['ID', 'Destination', 'Policy', 'Parameters', 'Active']) {
        await expect(page.getByRole('columnheader', { name: header })).toBeVisible()
      }
    }
    const docs = page.locator('[data-screen-intro] a')
    await expect(docs).toHaveAttribute('href', /smtp_tls_policy_maps/)
    await expectAccessible()
    await expectTouchTargets()
    await expectNoHorizontalScroll()
    await openFilters(page)
    await page.getByRole('checkbox', { name: 'dane', exact: true }).check()
    await page.getByRole('checkbox', { name: 'secure', exact: true }).check()
    await expect(page).toHaveURL(/policy=dane&policy=secure/)
    await listReady(page)
    expect(await entryIds(page)).toEqual(['4', '8'])
  })

  test('US6-AS2 FR-058 the add form lists the eight policies as legacy does', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('routing-admin-default')
    await page.goto('routing/tls-policy-maps/new')
    await expect(page.getByRole('heading', { level: 1, name: 'Add TLS policy map' })).toBeVisible()
    await expect(page.getByText('Examples: example.org, .example.org')).toBeVisible()
    const policy = page.getByLabel('Policy')
    await expect(policy.locator('option')).toHaveText([
      'none',
      'may',
      'encrypt',
      'dane',
      'dane-only',
      'fingerprint',
      'verify',
      'secure',
    ])
    await expect(page.getByLabel('Active')).toBeChecked()
    await expectAccessible()
    await page.getByLabel('Destination').fill('Bücher.example')
    await policy.selectOption('dane-only')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page).toHaveURL(/routing\/tls-policy-maps$/)
    await expect(polite(page)).toContainText('TLS policy map entry "xn--bcher-kva.example" has been saved')
  })

  test('US6-AS3 invalid values and a duplicate destination are refused at their fields', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('routing-admin-default')
    await page.goto('routing/tls-policy-maps/new')
    await page.getByLabel('Destination').fill('example.org:25')
    await page.getByLabel('Parameters').fill('broken')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.locator('#tls-form-destination-error')).toContainText('Policy destination is invalid')
    await expect(page.locator('#tls-form-parameters-error')).toContainText('Policy parameter is invalid')
    await page.getByLabel('Destination').fill('may.example')
    await page.getByLabel('Parameters').fill('')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.locator('#tls-form-destination-error')).toContainText(
      'A TLS policy map entry "may.example" exists',
    )
  })

  test('FR-058 the edit form, deletion and bulk actions', async ({ page, mockApi }) => {
    await mockApi.use('routing-admin-default')
    await page.goto('routing/tls-policy-maps/2')
    await expect(page.getByRole('heading', { level: 1, name: 'Edit object' })).toBeVisible()
    await page.getByLabel('Policy').selectOption('secure')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page).toHaveURL(/routing\/tls-policy-maps$/)
    await expect(polite(page)).toContainText('TLS policy map entry "may.example" has been saved')
    await listReady(page)
    await entry(page, 3).getByRole('button', { name: 'Remove: encrypt.example' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete now' }).click()
    await expect(polite(page)).toContainText('TLS policy map ID 3 has been deleted')
    await page.getByRole('button', { name: 'Select', exact: true }).click()
    await entry(page, 8).getByRole('checkbox').check()
    await page
      .getByRole('region', { name: 'Bulk actions' })
      .getByRole('button', { name: 'Activate', exact: true })
      .click()
    await expect(page.getByRole('region', { name: 'Results' })).toContainText(
      'TLS policy map entry "secure.example" has been saved',
    )
  })
})
