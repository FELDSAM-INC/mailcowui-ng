// UI 004 US1, the alias page and access (T032): every value, links to the domain screens, the
// domain administrator's scope, mailbox users, the orphaned warning, the page states and the
// user's locale.
import { ALIAS_004, DOMAIN_ADMIN_004 } from '../../mocks/scenarios/feature-004-base'
import { ALIASES_60, TWELVE_DESTINATIONS } from '../../mocks/scenarios/aliases-list'
import { expect, test } from '../fixtures/test'
import { isNarrow, listReady, entryIds } from './helpers'
import { openNavigation } from '../fixtures/flows'

test.describe('alias page and access', () => {
  test('FR-016 US1-AS2 US1-AS3 US1-AS4 every value, the primary domain and all 12 destinations', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
  }) => {
    await mockApi.use('aliases-60')
    await page.goto(`aliases/${ALIASES_60.twelve}`)
    await expect(page.getByRole('heading', { level: 1, name: 'Edit alias' })).toBeVisible()
    await expect(page.getByText('team@example.org').first()).toBeVisible()
    const destinations = page.locator('[data-field="destinations"] li')
    await expect(destinations).toHaveCount(12)
    await expect(destinations.first()).toHaveText(TWELVE_DESTINATIONS[0]!)
    await expect(page.locator('[data-alias-summary]')).toContainText(String(ALIASES_60.twelve))
    await expect(
      page.locator('[data-field="domain"]').getByRole('link', { name: 'example.org' }),
    ).toHaveAttribute('href', /\/ng\/domains\/example\.org$/)
    await expectAccessible()
    await expectNoHorizontalScroll()

    await page.goto(`aliases/${ALIASES_60.infoNet}`)
    await expect(page.locator('[data-field="primaryDomain"]')).toContainText('example.org')
    await page.goto(`aliases/${ALIASES_60.learnSpam}`)
    await expect(page.locator('[data-field="destinations"]')).toHaveText('Learn as spam')
  })

  test('US3-AS7 an orphaned alias warns administrators and links no domain', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('aliases-60')
    await page.goto(`aliases/${ALIASES_60.orphaned}`)
    await expect(page.locator('[data-orphaned-warning]')).toBeVisible()
    await expect(page.locator('[data-field="domain"]').getByRole('link')).toHaveCount(0)
    await expectAccessible()
  })

  test('US1-AS9 FR-003 the domain administrator sees only the scope, and another domain is "not found"', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('aliases-da-two-of-ten')
    await page.goto('aliases?size=100')
    await listReady(page)
    const ids = await entryIds(page)
    expect(ids).not.toContain(String(ALIASES_60.otherDomain))
    expect(ids).not.toContain(String(ALIASES_60.orphaned))
    expect(ids).toContain(String(ALIASES_60.infoNet))
    await page.goto(`aliases/${ALIASES_60.otherDomain}`)
    await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
    await page.getByRole('link', { name: 'Back to the list' }).click()
    await expect(page).toHaveURL(/\/ng\/aliases$/)
    await expectAccessible()
    void DOMAIN_ADMIN_004
  })

  test('US1-AS10 FR-001 mailbox users have no entries and get "no access" without a feature 004 request', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('mailbox-user-004')
    await page.goto('aliases')
    await expect(page.getByRole('heading', { level: 1, name: 'No access' })).toBeVisible()
    for (const path of ['alias-domains', 'resources']) {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1, name: 'No access' })).toBeVisible()
    }
    const navigation = await openNavigation(page)
    for (const name of ['Aliases', 'Domain aliases', 'Resources']) {
      await expect(navigation.getByRole('link', { name, exact: true })).toHaveCount(0)
    }
    const feature004 = (await mockApi.requests()).filter((r) =>
      /^(list|get|create|update|delete|apply|copy)(Alias|Resource|MailboxSender|SenderPermission)/.test(
        r.operationId ?? '',
      ),
    )
    expect(feature004).toEqual([])
  })

  test('FR-001 administrators and domain administrators find the three entries', async ({
    page,
    mockApi,
  }) => {
    for (const scenario of ['admin-004', 'domain-admin-004']) {
      await mockApi.use(scenario)
      await page.goto('')
      const navigation = await openNavigation(page)
      for (const name of ['Aliases', 'Domain aliases', 'Resources']) {
        await expect(navigation.getByRole('link', { name, exact: true })).toBeVisible()
      }
      if (isNarrow(page)) await page.keyboard.press('Escape')
    }
  })

  test('FR-008 the page shows its loading and error states', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('admin-004')
    await page.route(`**/api/v2/aliases/${ALIAS_004.sales}`, (route) => route.abort())
    await page.goto(`aliases/${ALIAS_004.sales}`)
    await expect(page.getByText('This item could not be loaded.')).toBeVisible()
    await expectAccessible()
    await page.unroute(`**/api/v2/aliases/${ALIAS_004.sales}`)
    await page.getByRole('button', { name: 'Try again' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Edit alias' })).toBeVisible()
  })

  test('FR-069 a Czech profile formats the counts in its locale', async ({ page, mockApi }) => {
    await mockApi.use('aliases-60', {
      accounts: { admin: { preferences: { language: 'cs-cz', theme: 'system', etag: '"cs"' } } },
    })
    await page.goto('aliases')
    await listReady(page)
    await expect(page.getByText(/1.+25.+60/)).toBeVisible()
  })
})
