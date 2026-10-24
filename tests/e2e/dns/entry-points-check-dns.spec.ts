// UI 010 US3, "DNS" on the earlier screens (T055, FR-023, FR-019): the domain list's entry
// actions, the domain page and the DKIM entry page open the diagnostics of the name; an unused
// key's entry has none. The alias domain list and page are UI 004's, which mounts the exported
// action there.
import { expect, test } from '../fixtures/test'
import { FIRST_LOAD } from './helpers'

test.describe('"DNS" entry points', () => {
  test('FR-023 the domain list entry actions open the diagnostics', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('dns-admin')
    await page.goto('domains')
    await page
      .getByRole('button', { name: 'Actions for example.org' })
      .click({ timeout: FIRST_LOAD })
    await expect(page.getByRole('menuitem', { name: 'DNS diagnostics' })).toBeVisible()
    await expectAccessible()
    await page.getByRole('menuitem', { name: 'DNS diagnostics' }).click()
    await expect(page).toHaveURL(/\/dns\/diagnostics\/example\.org$/)
    await expect(page.getByRole('heading', { level: 1, name: 'DNS Records' })).toBeVisible()
  })

  test('FR-023 a domain administrator has "DNS" on the domain page', async ({ page, mockApi }) => {
    await mockApi.use('dns-domain-admin')
    await page.goto('domains/example.net')
    await page
      .getByRole('link', { name: 'DNS diagnostics', exact: true })
      .click({ timeout: FIRST_LOAD })
    await expect(page).toHaveURL(/\/dns\/diagnostics\/example\.net$/)
  })

  test('FR-019 the DKIM entry has "DNS", an unused key has none', async ({ page, mockApi }) => {
    await mockApi.use('dns-admin')
    await page.goto('dns/dkim-keys/example.com')
    await page
      .getByRole('link', { name: 'DNS diagnostics', exact: true })
      .click({ timeout: FIRST_LOAD })
    await expect(page).toHaveURL(/\/dns\/diagnostics\/example\.com$/)
    await page.goto('dns/dkim-keys/Legacy.Example')
    await expect(page.getByRole('heading', { level: 1, name: 'Legacy.Example' })).toBeVisible({
      timeout: FIRST_LOAD,
    })
    await expect(page.getByRole('link', { name: 'DNS diagnostics', exact: true })).toHaveCount(0)
  })
})
