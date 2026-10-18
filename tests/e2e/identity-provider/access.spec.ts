// UI 012 US1-AS8, FR-001, FR-002, SC-010 (T019): only administrators see "Identity providers and
// OAuth2"; the other roles get "no access" in place and cause no API 012 request.
import { expect, test } from '../fixtures/test'
import { API_012_OPERATIONS, isMobile, openProvider } from './helpers'

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
    if (isMobile(page)) {
      await page.getByRole('button', { name: 'Toggle navigation' }).click()
      await expect(
        page.getByRole('dialog').getByRole('link', { name: 'Identity providers and OAuth2' }),
      ).toHaveCount(0)
      await page.keyboard.press('Escape')
    } else {
      await expect(
        page
          .getByRole('navigation', { name: 'Main navigation' })
          .getByRole('link', { name: 'Identity providers and OAuth2' }),
      ).toHaveCount(0)
    }
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
  if (isMobile(page)) {
    await page.getByRole('button', { name: 'Toggle navigation' }).click()
    await page
      .getByRole('dialog')
      .getByRole('link', { name: 'Identity providers and OAuth2' })
      .click()
  } else {
    await page
      .getByRole('navigation', { name: 'Main navigation' })
      .getByRole('link', { name: 'Identity providers and OAuth2' })
      .click()
  }
  await expect(page).toHaveURL(/\/ng\/identity-providers\/provider$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Identity Provider' })).toBeVisible()
  const nav = page.getByRole('navigation', { name: 'Identity providers and OAuth2' })
  await expect(nav.getByRole('link', { name: 'Identity Provider' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await openProvider(page)
  await expectAccessible()
})
