// UI 009 FR-023, the relayhost usage view (T028): the paged form of legacy's "In use by" cell, with
// the kind filter, the name search and the sort in the address, each entry linking to its page.
import { expect, test } from '../fixtures/test'
import { entryIds, listReady, openFilters, search } from './helpers'

test.describe('relayhost usage', () => {
  test('FR-023 lists, filters and searches the domains and mailboxes of a relayhost', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
  }) => {
    await mockApi.use('routing-admin-default')
    await page.goto('routing/relayhosts')
    await listReady(page)
    await page.locator('[data-entry="2"] [data-usage]').click()
    await expect(page).toHaveURL(/routing\/relayhosts\/2\/usage$/)
    await expect(page.getByRole('heading', { level: 1, name: 'In use by' })).toBeVisible()
    await listReady(page)
    expect(await entryIds(page)).toEqual([
      'domain:example.net',
      'domain:example.org',
      'mailbox:alice@example.org',
      'mailbox:bob@example.org',
      'mailbox:carol@example.net',
    ])
    await expectAccessible()
    await expectNoHorizontalScroll()
    await openFilters(page)
    await page.getByLabel('Kind', { exact: true }).selectOption('mailbox')
    await expect(page).toHaveURL(/kind=mailbox/)
    await search(page, 'bob')
    expect(await entryIds(page)).toEqual(['mailbox:bob@example.org'])
    await page.reload()
    await listReady(page)
    expect(await entryIds(page)).toEqual(['mailbox:bob@example.org'])
    await expect(page.getByRole('link', { name: 'bob@example.org' })).toHaveAttribute(
      'href',
      /\/ng\/mailboxes\/bob@example.org$/,
    )
    await page.goto('routing/relayhosts/2/usage?kind=domain')
    await listReady(page)
    await expect(page.getByRole('link', { name: 'example.org' })).toHaveAttribute(
      'href',
      /\/ng\/domains\/example.org$/,
    )
  })
})
