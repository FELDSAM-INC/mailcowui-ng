// UI 002 US6, the template list (T079): the navigation entry and the link from the domain list,
// paging, search and sort, the classic columns as cards and table, the list states, single
// deletion with the classic confirmation, the classic removal of selected templates with the bulk
// operation (gap G40), and access.
import { expect, test } from '../fixtures/test'
import { openNavigation } from '../fixtures/flows'
import { entry, entryNames, isNarrow, listReady, resultCount } from '../domains/helpers'

test.describe('template list', () => {
  test('FR-049 reachable from the navigation and the domain list; 33 templates by name with Default marked', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
  }) => {
    await mockApi.use('templates')
    await page.goto('domains')
    await page.getByRole('link', { name: 'Domain Templates' }).first().click()
    await expect(page.getByRole('heading', { level: 1, name: 'Domain Templates' })).toBeVisible()
    await listReady(page)
    expect(await resultCount(page)).toBe('Templates found: 33')
    const names = await entryNames(page)
    expect(names).toHaveLength(25)
    await expect(entry(page, '1').locator('[data-default-badge]')).toHaveText('Default')
    await expectAccessible()
    await expectNoHorizontalScroll()

    await page.goto('')
    const navigation = await openNavigation(page)
    await navigation.getByRole('link', { name: 'Domains', exact: true }).click()
    await expect(
      page.getByRole('heading', { level: 1, name: 'Domains', exact: true }),
    ).toBeVisible()
    const tabs = page.getByRole('navigation', { name: 'Domains', exact: true })
    const toggle = tabs.getByRole('button')
    if (await toggle.isVisible()) await toggle.click()
    await tabs.getByRole('link', { name: 'Domain Templates', exact: true }).click()
    await expect(page).toHaveURL(/\/ng\/domain-templates$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Domain Templates' })).toBeVisible()
  })

  test('FR-049 the search, every sort key, the order and the page size are in the address', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('templates')
    await page.goto('domain-templates')
    await listReady(page)
    await page.getByRole('searchbox', { name: 'Search:' }).fill('pack')
    await expect(page).toHaveURL(/q=pack/)
    await expect(page.locator('[data-result-count]')).toHaveText('Templates found: 30')
    for (const [value, label] of [
      ['id', 'ID'],
      ['createdAt', 'Created on'],
      ['modifiedAt', 'Last modified'],
      ['name', 'Template'],
    ]) {
      await page.getByLabel('Sort by').selectOption({ label })
      await expect(page).toHaveURL(value === 'name' ? /^(?!.*sort=)/ : new RegExp(`sort=${value}`))
    }
    await page.getByLabel('Order').selectOption('desc')
    await expect(page).toHaveURL(/order=desc/)
    await expect(page.locator('[data-entry]').first()).toHaveAttribute('data-entry', '33')
    await page.locator('[data-page-size] select').selectOption('50')
    await expect(page).toHaveURL(/size=50/)
  })

  test('FR-050 the classic values: cards below md, a table with details from md up', async ({
    page,
    mockApi,
    expectAccessible,
    expectTouchTargets,
  }) => {
    await mockApi.use('templates')
    await page.goto('domain-templates?q=reseller')
    await listReady(page)
    const reseller = entry(page, '3')
    if (isNarrow(page)) {
      await expect(reseller.getByRole('heading', { level: 3, name: 'Reseller' })).toBeVisible()
      await expect(reseller).toContainText('Max. possible mailboxes:')
      await expect(reseller).toContainText('Total domain quota:')
      await expect(reseller).toContainText('50 GiB')
    } else {
      await expect(page.getByRole('columnheader', { name: 'Template' })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: 'Max. aliases' })).toBeVisible()
      await expect(reseller).toContainText('500')
    }
    await reseller.getByRole('button', { name: 'Details of Reseller' }).click()
    const details = page.locator('[data-entry-details="3"]')
    await expect(details).toContainText('100 msgs / hour')
    await expect(details).toContainText('1,024')
    await expect(details).toContainText('reseller')
    await expect(details).toContainText('gold')
    await expectAccessible()
    if (isNarrow(page)) await expectTouchTargets()
  })

  test('FR-056 the empty list, no matches, and an error with retry', async ({ page, mockApi }) => {
    await mockApi.use('templates-empty')
    await page.goto('domain-templates')
    await expect(page.getByText('No data available in table')).toBeVisible()
    await expect(
      page.getByRole('main').getByRole('link', { name: 'Add Template' }).last(),
    ).toBeVisible()

    await mockApi.use('templates')
    await page.goto('domain-templates?q=nothing-like-this')
    await expect(page.getByText('No matching records found')).toBeVisible()
    await page.getByRole('button', { name: 'Clear search' }).last().click()
    await expect(page).not.toHaveURL(/q=/)
    await listReady(page)

    await mockApi.use('templates-list-error')
    await page.goto('domain-templates')
    await expect(page.getByText('The list could not be loaded.')).toBeVisible()

    await mockApi.use('templates')
    await mockApi.failNext('listDomainTemplates', { status: 500 })
    await page.goto('domain-templates')
    await expect(page.getByText('The list could not be loaded.')).toBeVisible()
    await page.getByRole('button', { name: 'Try again' }).click()
    await expect(page.locator('[data-result-count]')).toHaveText('Templates found: 33')
  })

  test('FR-055 US6-AS4 removing a template asks with the classic confirmation and says domains keep their values', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('templates')
    await page.goto('domain-templates?sort=id')
    await listReady(page)
    await expect(entry(page, '1').getByRole('button', { name: /^Remove/ })).toHaveCount(0)
    await entry(page, '2').getByRole('button', { name: 'Remove: Small' }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog.getByRole('heading', { name: 'Confirm deletion' })).toBeVisible()
    await expect(dialog).toContainText('Please confirm your changes to the following object id')
    await expect(dialog).toContainText('Small')
    await expect(dialog).toContainText('Domains created from this template keep their values.')
    await expectAccessible()
    await dialog.getByRole('button', { name: 'Delete now' }).click()
    await expect(entry(page, '2')).toHaveCount(0)
    await expect(page.locator('[data-live="polite"]')).toContainText(
      'Template ID 2 has been deleted',
    )
    const deletion = (await mockApi.requests()).find(
      (request) => request.operationId === 'deleteDomainTemplate' && request.status === 204,
    )
    expect(deletion?.headers['if-match']).toMatch(/^"t/)
  })

  test('a removal refused as outdated reloads the template and asks again', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('templates')
    await page.goto('domain-templates?sort=id')
    await listReady(page)
    await mockApi.mutateTemplate(2, { maxAliases: 77 })
    await entry(page, '2').getByRole('button', { name: 'Remove: Small' }).click()
    const dialog = page.getByRole('alertdialog')
    await dialog.getByRole('button', { name: 'Delete now' }).click()
    await expect(dialog).toContainText('The template changed in the meantime.')
    await dialog.getByRole('button', { name: 'Delete now' }).click()
    await expect(entry(page, '2')).toHaveCount(0)
  })

  test('FR-055 removing selected templates: Default not selectable, the count typed, one request, a row each and a retry', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('templates')
    await page.goto('domain-templates?sort=id')
    await listReady(page)
    await page.getByRole('button', { name: 'Select', exact: true }).click()
    await expect(page.getByRole('checkbox', { name: 'Select Default' })).toHaveCount(0)
    for (const name of ['Small', 'Reseller', 'Package 01']) {
      await page.getByRole('checkbox', { name: `Select ${name}` }).check()
    }
    const bar = page.getByRole('region', { name: 'Bulk actions' })
    await expect(bar).toContainText('3 selected')
    await mockApi.mutateTemplate(3, { maxAliases: 77 })
    await mockApi.removeTemplate(4)
    await bar.getByRole('button', { name: 'Remove' }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toContainText('Confirm deletion')
    await expect(dialog).toContainText('Package 01')
    await expect(dialog).toContainText('Domains created from these templates keep their values.')
    const confirm = dialog.getByRole('button', { name: 'Delete now' })
    await expect(confirm).toBeDisabled()
    await expectAccessible()
    await dialog.getByRole('textbox').fill('3')
    await confirm.click()
    const results = page.getByRole('region', { name: 'Results' })
    await expect(results.locator('li', { hasText: 'Done' })).toHaveCount(1)
    await expect(results.locator('li', { hasText: 'Changed in the meantime' })).toContainText(
      'Reseller',
    )
    await expect(results.locator('li', { hasText: 'Not found' })).toContainText('Package 01')
    await expect(bar).toContainText('1 selected')
    const requests = (await mockApi.requests()).filter(
      (r) => r.operationId === 'applyDomainTemplateBulkAction' && r.status !== 403,
    )
    expect(requests).toHaveLength(1)
    expect((requests[0]!.body as { targets: { version: string }[] }).targets).toHaveLength(3)
    await results.getByRole('button', { name: 'Retry the failed ones' }).click()
    await expect(results.locator('li', { hasText: 'Done' })).toHaveCount(1)
    await expect(entry(page, '3')).toHaveCount(0)
  })

  test('US6-AS5 a domain administrator has no Domain Templates entry and no access', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('domain-admin-two-of-ten')
    await page.goto('domains')
    await listReady(page)
    await expect(page.getByRole('link', { name: 'Domain Templates' })).toHaveCount(0)
    await page.goto('domain-templates')
    await expect(page.getByRole('heading', { level: 1, name: 'No access' })).toBeVisible()
  })
})
