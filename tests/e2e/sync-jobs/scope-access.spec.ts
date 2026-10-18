// UI 008 US1 scope and access (T024): each role sees its scope, roles without the syncjobs flag
// see neither the entry nor the screens, "not found" for unknown and foreign jobs, and the changes
// behind the user's back (flag revoked, job deleted, mailbox renamed).
import { permissionFlags } from '../../mocks/scenarios/accounts'
import { expect, test } from '../fixtures/test'
import { entries, entry, entryIds, isNarrow, listReady, requestsOf } from './helpers'

async function openNavigation(page: import('@playwright/test').Page) {
  if ((page.viewportSize()?.width ?? 0) < 1024) {
    await page.getByRole('button', { name: 'Toggle navigation' }).click()
  }
  return page.getByRole('navigation', { name: 'Main navigation' })
}

test.describe('sync job scope and access', () => {
  test('US1-AS3 FR-002 a domain administrator sees only the jobs of example.org', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('sync-jobs-domain-admin')
    await page.goto('sync-jobs?size=100')
    await listReady(page)
    const ids = await entryIds(page)
    expect(ids).not.toContain(3)
    expect(ids).toContain(2)
    for (const id of ids.slice(0, 5)) await expect(entry(page, id)).toContainText('@example.org')
    await expectAccessible()
  })

  test('US1-AS4 a mailbox user sees only their jobs, without an owner column, filter or sort', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('sync-jobs-user')
    await page.goto('sync-jobs')
    await expect(page.getByRole('heading', { level: 1, name: 'Sync jobs' })).toBeVisible()
    await listReady(page)
    expect(await entryIds(page)).toEqual([2, 1])
    await expect(page.getByText('Owner')).toHaveCount(0)
    await page.getByRole('button', { name: /^Filters/ }).click()
    await expect(page.getByLabel('Owner')).toHaveCount(0)
    if (isNarrow(page)) {
      await expect(page.getByLabel('Sort by').locator('option[value="mailbox"]')).toHaveCount(0)
    } else {
      await expect(page.getByRole('columnheader', { name: 'Username' })).toBeVisible()
    }
    await expectAccessible()
  })

  test('FR-001 FR-003 Edge: roles without the flag get no entry and "not permitted" without a request', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    for (const scenario of ['sync-jobs-domain-admin-no-flag', 'sync-jobs-user-no-flag']) {
      await mockApi.use(scenario)
      await page.goto('')
      const nav = await openNavigation(page)
      await expect(nav.getByRole('link', { name: 'Sync jobs' })).toHaveCount(0)
      for (const path of ['sync-jobs', 'sync-jobs/1']) {
        await page.goto(path)
        await expect(page.getByRole('heading', { name: 'No access' })).toBeVisible()
      }
      await expectAccessible()
      const syncRequests = (await mockApi.requests()).filter((r) =>
        r.operationId?.toLowerCase().includes('syncjob'),
      )
      expect(syncRequests).toEqual([])
    }
  })

  test('Edge: revoking the flag at runtime shows "not permitted" and removes the entry', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('sync-jobs-domain-admin')
    await page.goto('sync-jobs')
    await listReady(page)
    await mockApi.patch({
      accounts: {
        reseller: { permissions: permissionFlags(true, { syncjobs: false, bccMaps: false }) },
      },
    })
    await page.getByRole('button', { name: 'Refresh' }).click()
    await expect(page.getByRole('heading', { name: 'No access' })).toBeVisible()
    const nav = await openNavigation(page)
    await expect(nav.getByRole('link', { name: 'Sync jobs' })).toHaveCount(0)
  })

  test('FR-003 unknown and foreign jobs show "not found" with a way back', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('sync-jobs-user')
    for (const path of ['sync-jobs/999999', 'sync-jobs/3']) {
      await page.goto(path)
      await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
      await expect(page.getByRole('link', { name: 'Back to the sync jobs' })).toBeVisible()
    }
    await expectAccessible()
    const before = (await requestsOf(mockApi, 'getSyncJob')).length
    await page.goto('sync-jobs/9999999999')
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
    expect((await requestsOf(mockApi, 'getSyncJob')).length).toBe(before)
  })

  test('Edge: a job deleted at runtime says it no longer exists and leads back to the list', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('sync-jobs-admin')
    await page.goto('sync-jobs/2')
    await expect(page.getByRole('heading', { level: 1, name: 'Edit sync job' })).toBeVisible()
    await mockApi.patch({ syncJobs: { delete: 2 } })
    await page.getByRole('button', { name: 'Edit Edit sync job' }).click()
    await page.getByLabel('Interval (min)').fill('33')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByText('This sync job no longer exists.')).toBeVisible()
    await page.getByRole('link', { name: 'Back to the sync jobs' }).click()
    await listReady(page)
    expect(await entryIds(page)).not.toContain(2)
  })

  test('Edge: a renamed target mailbox shows under the new address after Refresh', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('sync-jobs-admin')
    await page.goto('sync-jobs?q=dora')
    await listReady(page)
    await mockApi.patch({
      syncJobs: { renameMailbox: { from: 'dora@example.org', to: 'dora.new@example.org' } },
    })
    await page.getByRole('button', { name: 'Refresh' }).click()
    await expect(entries(page).first()).toContainText('dora.new@example.org')
  })
})
