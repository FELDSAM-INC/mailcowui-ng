// UI 009 US7, recipient maps (T097): the classic columns, search, the active filter and the sort,
// legacy's add and edit forms with their info texts, refusals with legacy's messages, deletion and
// bulk actions.
import { expect, test } from '../fixtures/test'
import { entry, entryIds, isNarrow, listReady, polite, search } from './helpers'

test.describe('recipient maps', () => {
  test('US7-AS1 FR-055 FR-008 the classic columns and the hint', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
    expectTouchTargets,
  }) => {
    await mockApi.use('routing-admin-default')
    await page.goto('routing/recipient-maps')
    await expect(page.getByRole('heading', { level: 1, name: 'Recipient maps' })).toBeVisible()
    await listReady(page)
    expect(await entryIds(page)).toEqual(['1', '2'])
    await expect(entry(page, 1)).toContainText('@old.example')
    await expect(entry(page, 1)).toContainText('@new.example')
    if (!isNarrow(page)) {
      for (const header of ['ID', 'Original recipient', 'New recipient', 'Active']) {
        await expect(page.getByRole('columnheader', { name: header })).toBeVisible()
      }
    }
    await expect(page.locator('[data-screen-intro]')).toContainText('replace the destination address')
    await expectAccessible()
    await expectTouchTargets()
    await expectNoHorizontalScroll()
    await search(page, 'robert')
    expect(await entryIds(page)).toEqual(['2'])
    await page.goto('routing/recipient-maps?active=true')
    await listReady(page)
    expect(await entryIds(page)).toEqual(['1'])
  })

  test('FR-056 US7-AS2 US7-AS3 the add form with legacy’s hints and refusals', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('routing-admin-default')
    await page.goto('routing/recipient-maps/new')
    await expect(page.getByRole('heading', { level: 1, name: 'Add recipient map' })).toBeVisible()
    await expect(page.getByText("A recipient maps original destination must be a valid")).toBeVisible()
    await expect(page.getByLabel('Active')).toBeChecked()
    await expectAccessible()
    await page.getByLabel('Original recipient').fill('not valid')
    await page.getByLabel('New recipient').fill('@new.example')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.locator('#recipient-form-originalDestination-error')).toContainText(
      'Invalid original recipient specified: not valid',
    )
    await page.getByLabel('Original recipient').fill('@old.example')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.locator('#recipient-form-originalDestination-error')).toContainText(
      'A Recipient map entry "@old.example" exists',
    )
    await page.getByLabel('Original recipient').fill('OLD3.example')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page).toHaveURL(/routing\/recipient-maps$/)
    await expect(polite(page)).toContainText('Recipient map entry "@old3.example" has been saved')
  })

  test('FR-056 the edit form, deletion and bulk actions', async ({ page, mockApi }) => {
    await mockApi.use('routing-admin-default')
    await page.goto('routing/recipient-maps/2')
    await expect(page.getByLabel('New recipient')).toHaveValue('robert@new.example')
    await page.getByLabel('New recipient').fill('bob@new.example')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page).toHaveURL(/routing\/recipient-maps$/)
    await expect(polite(page)).toContainText('Recipient map entry "bob@old.example" has been saved')
    await listReady(page)
    await page.getByRole('button', { name: 'Select', exact: true }).click()
    await entry(page, 2).getByRole('checkbox').check()
    await page
      .getByRole('region', { name: 'Bulk actions' })
      .getByRole('button', { name: 'Remove' })
      .click()
    await page.getByRole('alertdialog').getByLabel('Type 1 to confirm').fill('1')
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete now' }).click()
    await expect(page.getByRole('region', { name: 'Results' })).toContainText(
      'Recipient map ID 2 has been deleted',
    )
  })
})
