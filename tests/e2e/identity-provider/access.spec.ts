// UI 012 US1-AS8, FR-001, FR-002, SC-010 (T019): only administrators see Access → Identity Provider;
// the other roles get "no access" in place and cause no API 012 request.
import { openNavigation } from '../fixtures/flows'
import { expect, test } from '../fixtures/test'
import { API_012_OPERATIONS, isMobile } from './helpers'

for (const [role, username] of [
  ['domain administrator', 'reseller'],
  ['mailbox user', 'alice@example.org'],
] as const) {
  test(`US1-AS8 FR-002 a ${role} has no entry and gets "no access" without requests`, async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('admin-active', { signedInAs: username })
    await page.goto('identity-providers/provider')
    await expect(page.getByRole('heading', { level: 1, name: 'No access' })).toBeVisible()
    const navigation = await openNavigation(page)
    await expect(navigation.getByRole('link', { name: 'Access', exact: true })).toHaveCount(0)
    if (isMobile(page)) await page.keyboard.press('Escape')
    await page.goto('identity-providers')
    await expect(page.getByRole('heading', { level: 1, name: 'No access' })).toBeVisible()
    const requests = (await mockApi.requests()).filter((request) =>
      API_012_OPERATIONS.includes(request.operationId ?? ''),
    )
    expect(requests).toEqual([])
    await expectAccessible()
  })
}

test('FR-001 the administrator entry opens the identity provider screen; the section root redirects', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('idp-none')
  await page.goto('')
  const navigation = await openNavigation(page)
  await navigation.getByRole('link', { name: 'Access', exact: true }).click()
  const nav = page.getByRole('navigation', { name: 'Access', exact: true })
  await expect(nav).toBeVisible()
  const toggle = nav.getByRole('button')
  if (await toggle.isVisible()) await toggle.click()
  await nav.getByRole('link', { name: 'Identity Provider', exact: true }).click()
  await expect(page).toHaveURL(/\/ng\/identity-providers\/provider$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Identity Provider' })).toBeVisible()
  await expect(nav.locator('[aria-current="page"]')).toHaveText('Identity Provider')
  await page.goto('identity-providers')
  await expect(page).toHaveURL(/\/ng\/identity-providers\/provider$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Identity Provider' })).toBeVisible()
  await expect(page.locator('[data-page-loading]')).toHaveCount(0)
  await expectAccessible()
})
