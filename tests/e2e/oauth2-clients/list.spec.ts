// UI 012 US5, the OAuth2 apps list (T077), mirroring the classic "OAuth2 Apps" tab: the classic
// information text, the columns ID, client ID, redirect URI and action (no secret), cards below md
// and a table from md up, the search, sort, page and page size in the address, the list states and
// access for administrators only.
import { expect, test } from '../fixtures/test'
import { entry, entryIds, fixedClientId, isNarrow, listReady } from './helpers'

test.describe('OAuth2 apps list', () => {
  test('US5-AS1 FR-055 FR-057 the classic columns and information, no secret anywhere', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
    expectTouchTargets,
  }) => {
    await mockApi.use('oauth2-many')
    await page.goto('identity-providers/oauth2-apps')
    await expect(page.getByRole('heading', { level: 1, name: 'OAuth2 Apps' })).toBeVisible()
    await listReady(page)
    const nav = page.getByRole('navigation', { name: 'Access', exact: true })
    const toggle = nav.getByRole('button')
    if (await toggle.isVisible()) await toggle.click()
    await expect(nav.getByRole('link', { name: 'OAuth2 Apps' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect(nav.getByRole('link', { name: 'Identity Provider' })).toBeVisible()
    if (await toggle.isVisible()) await toggle.click()
    await expect(page.getByRole('main')).toContainText(
      'The OAuth2 implementation supports the grant type "Authorization Code"',
    )
    await expect(page.getByRole('main').locator('code').first()).toHaveText('/oauth/authorize')
    expect(await entryIds(page)).toHaveLength(25)
    const wiki = entry(page, 3)
    await expect(wiki).toContainText(fixedClientId(3))
    await expect(wiki).toContainText('https://wiki.example.org/oauth/callback')
    await expect(wiki).toContainText('https://wiki.example.org/oauth/callback2')
    if (isNarrow(page)) {
      await expect(wiki.getByRole('heading', { level: 3, name: fixedClientId(3) })).toBeVisible()
    } else {
      for (const header of ['ID', 'Client ID', 'Redirect URI', 'Action']) {
        await expect(page.getByRole('columnheader', { name: header, exact: true })).toBeVisible()
      }
      await expect(page.getByRole('columnheader', { name: 'Client secret' })).toHaveCount(0)
    }
    await expect(wiki.getByRole('link', { name: `Edit: ${fixedClientId(3)}` })).toBeVisible()
    await expect(wiki.getByRole('button', { name: `Remove: ${fixedClientId(3)}` })).toBeVisible()
    // No stored secret is ever shown (owner decision).
    await expect(page.locator('body')).not.toContainText('00000000f00d0003')
    await expectAccessible()
    await expectNoHorizontalScroll()
    await expectTouchTargets()
  })

  test('US5-AS7 FR-054 the search, sort, page and page size are kept in the address', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('oauth2-many')
    await page.goto('identity-providers/oauth2-apps')
    await listReady(page)
    await page.getByRole('searchbox', { name: 'Search:' }).fill('wiki')
    await expect(page).toHaveURL(/q=wiki/)
    await expect.poll(() => entryIds(page)).toEqual(['3', '17'])
    await page.reload()
    await listReady(page)
    expect(await entryIds(page)).toEqual(['3', '17'])
    await expect(page.getByRole('searchbox', { name: 'Search:' })).toHaveValue('wiki')
    await page.getByRole('button', { name: 'Clear search' }).click()
    await expect(page).not.toHaveURL(/q=/)

    await page.getByLabel('Sort by').selectOption({ label: 'Client ID' })
    await expect(page).toHaveURL(/sort=clientId/)
    await page.getByLabel('Order').selectOption('desc')
    await expect(page).toHaveURL(/order=desc/)
    await expect(page.locator('[data-entry]').first()).toHaveAttribute('data-entry', '40')
    await page.getByLabel('Sort by').selectOption({ label: 'ID' })
    await page.getByLabel('Order').selectOption('asc')
    await page.locator('[data-page-size] select').selectOption('50')
    await expect(page).toHaveURL(/size=50/)
    await expect.poll(() => entryIds(page)).toHaveLength(40)
    await page.locator('[data-page-size] select').selectOption('25')
    await page
      .getByRole('link', { name: 'Next' })
      .or(page.getByRole('button', { name: 'Next' }))
      .first()
      .click()
    await expect(page).toHaveURL(/page=2/)
    await expect(page.locator('[data-entry]').first()).toHaveAttribute('data-entry', '26')
  })

  test('FR-054 table headers sort with aria-sort on wide screens', async ({ page, mockApi }) => {
    test.skip(isNarrow(page), 'the table appears from md up')
    await mockApi.use('oauth2-many')
    await page.goto('identity-providers/oauth2-apps')
    await listReady(page)
    const idHeader = page.getByRole('columnheader', { name: 'ID', exact: true })
    await expect(idHeader).toHaveAttribute('aria-sort', 'ascending')
    await idHeader.getByRole('button').click()
    await expect(page).toHaveURL(/order=desc/)
    await expect(idHeader).toHaveAttribute('aria-sort', 'descending')
    await page.getByRole('columnheader', { name: 'Redirect URI' }).getByRole('button').click()
    await expect(page).toHaveURL(/sort=redirectUri/)
  })

  test('US5-AS8 FR-056 the empty state offers to add a client; a search without matches offers to clear it', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('oauth2-empty')
    await page.goto('identity-providers/oauth2-apps')
    await listReady(page)
    await expect(page.getByText('No data available in table')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Add OAuth2 client' }).last()).toBeVisible()
    await expectAccessible()

    await mockApi.use('oauth2-many')
    await page.goto('identity-providers/oauth2-apps?q=nothing-matches')
    await listReady(page)
    await expect(page.getByText('No matching records found')).toBeVisible()
    await page.getByRole('button', { name: 'Clear search' }).last().click()
    await expect(page).not.toHaveURL(/q=/)
    await listReady(page)
    expect(await entryIds(page)).toHaveLength(25)
  })

  test('FR-003 the loading and error states, with a retry that recovers', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('oauth2-many')
    await mockApi.failNext('listOauth2Clients', { status: 500 })
    await page.goto('identity-providers/oauth2-apps')
    await expect(page.getByText('The list could not be loaded.')).toBeVisible()
    await expectAccessible()
    await page.getByRole('button', { name: 'Try again' }).click()
    await listReady(page)
    expect(await entryIds(page)).toHaveLength(25)
  })

  test('Edge: very long redirect URIs wrap at 360 px', async ({
    page,
    mockApi,
    expectNoHorizontalScroll,
  }) => {
    await mockApi.use('oauth2-many')
    await page.goto('identity-providers/oauth2-apps')
    await listReady(page)
    await expect(entry(page, 9)).toContainText('https://very-long.example.org/callback/')
    await expectNoHorizontalScroll()
  })

  test('SC-010 domain administrators and mailbox users get "no access" without API 012 requests', async ({
    page,
    mockApi,
  }) => {
    for (const scenario of ['domain-admin-two-domains', 'mailbox-no-spam-flags']) {
      await mockApi.use(scenario)
      await page.goto('identity-providers/oauth2-apps')
      await expect(page.getByRole('heading', { level: 1, name: 'No access' })).toBeVisible()
      await page.goto('identity-providers/oauth2-apps/new')
      await expect(page.getByRole('heading', { level: 1, name: 'No access' })).toBeVisible()
      const requests = await mockApi.requests()
      expect(requests.filter((r) => /oauth2|identity-provider/i.test(r.operationId ?? ''))).toEqual(
        [],
      )
    }
  })
})
