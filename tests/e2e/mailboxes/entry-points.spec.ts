// UI 003 entry points (T123, FR-005): the domain page leads to the domain's mailboxes and to a new
// mailbox in it, and the home screen offers the mailbox screens to administrators and domain
// administrators.
import { listReady } from '../domains/helpers'
import { expect, test } from '../fixtures/test'

test.describe('entry points', () => {
  test('FR-005 the domain page opens its mailboxes and the add form with the domain chosen', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('admin-create')
    await page.goto('domains/example.org')
    await expect(page.getByRole('heading', { level: 1, name: 'Edit domain' })).toBeVisible()
    await page.getByRole('main').getByRole('link', { name: 'Mailboxes', exact: true }).click()
    await expect(page).toHaveURL(/\/ng\/mailboxes\?domain=example\.org$/)
    await listReady(page)
    await page.goBack()
    await page.getByRole('main').getByRole('link', { name: 'Add mailbox' }).click()
    await expect(page).toHaveURL(/\/ng\/mailboxes\/new\?domain=example\.org$/)
    await expect(page.locator('[data-mailbox-form]')).toContainText('@example.org')
  })
})
