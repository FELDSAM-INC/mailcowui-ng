// UI 008 US1 entry points (T027, FR-004): the navigation entry per role, and the list opened
// pre-filtered to one mailbox, as UI 003's mailbox page links to it.
import { expect, test } from '../fixtures/test'
import { entry, entryIds, listReady, openFilters } from './helpers'

test.describe('sync job entry points', () => {
  test('a mailbox user with the flag finds "Sync jobs" in the navigation', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('sync-jobs-user')
    await page.goto('')
    if ((page.viewportSize()?.width ?? 0) < 1024) {
      await page.getByRole('button', { name: 'Toggle navigation' }).click()
    }
    await page
      .getByRole('navigation', { name: 'Main navigation' })
      .getByRole('link', { name: 'Sync jobs' })
      .click()
    await expect(page).toHaveURL(/\/ng\/sync-jobs$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Sync jobs' })).toBeVisible()
  })

  test('FR-004 the list opens filtered to one mailbox through its address', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('sync-jobs-admin')
    await page.goto('sync-jobs?mailbox=alice%40example.org')
    await listReady(page)
    for (const id of await entryIds(page)) await expect(entry(page, id)).toContainText('alice@')
    await openFilters(page)
    await expect(page.getByRole('button', { name: 'Filters (1)' })).toBeVisible()
  })

  test("FR-004 the mailbox page links to the mailbox's sync jobs for permitted managers", async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    for (const scenario of ['sync-jobs-admin', 'sync-jobs-domain-admin']) {
      await mockApi.use(scenario)
      await page.goto('mailboxes/alice@example.org')
      const link = page.getByRole('link', { name: 'Sync jobs', exact: true }).last()
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await expect(link).toHaveAttribute(
        'href',
        /\/ng\/sync-jobs\?mailbox=alice(%40|@)example\.org$/,
      )
      await expectAccessible()
      await link.click()
      await expect(page).toHaveURL(/sync-jobs\?mailbox=alice/)
      await listReady(page)
      for (const id of await entryIds(page)) await expect(entry(page, id)).toContainText('alice@')
    }
  })

  test('FR-004 a domain administrator without the flag sees no sync jobs link on the mailbox page', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('sync-jobs-domain-admin-no-flag')
    await page.goto('mailboxes/alice@example.org')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(
      page.locator('main').getByRole('link', { name: 'Sync jobs', exact: true }),
    ).toHaveCount(0)
  })
})
