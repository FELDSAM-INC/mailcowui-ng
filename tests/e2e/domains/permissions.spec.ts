// UI 002 permission matrix (T057, SC-005, FR-001, FR-002): exactly the allowed actions on the list,
// the domain page's Domain section (as the classic page shows it to each role) and the add address.
import { expect, test } from '../fixtures/test'
import { isMobile, listReady } from './helpers'

const matrix = [
  { scenario: 'domain-edit', who: 'administrator', create: true, limits: true, description: true },
  {
    scenario: 'domain-admin-desc',
    who: 'domain administrator with domainDesc',
    create: false,
    limits: false,
    description: true,
  },
  {
    scenario: 'domain-admin-no-desc',
    who: 'domain administrator without domainDesc',
    create: false,
    limits: false,
    description: false,
  },
] as const

for (const row of matrix) {
  test(`SC-005 the ${row.who} is offered exactly the actions of the matrix`, async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use(row.scenario)
    await page.goto('domains')
    await listReady(page)
    await expect(page.locator('[data-entry="edit.example"]')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Add domain' })).toHaveCount(row.create ? 1 : 0)
    await page.goto('domains/edit.example')
    await expect(page.getByRole('heading', { level: 1, name: 'Edit domain' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Edit Rate limit' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Edit Edit domain' }).click()
    await expect(page.locator('#section-domain-maxAliases')).toHaveCount(row.limits ? 1 : 0)
    await expect(page.locator('#section-domain-relay-backupMx')).toHaveCount(row.limits ? 1 : 0)
    const description = page.locator('#section-domain-description')
    if (row.description) await expect(description).not.toHaveAttribute('readonly', '')
    else await expect(description).toHaveAttribute('readonly', '')
    if (row.limits) await expect(page.locator('#section-domain-active')).toBeEnabled()
    else await expect(page.locator('#section-domain-active')).toBeDisabled()
    await page.goto('domains/-/new')
    await expect(
      page.getByRole('heading', { level: 1, name: row.create ? 'Add domain' : 'No access' }),
    ).toBeVisible()
    await expectAccessible()
  })
}

test('Edge: a mailbox user has no Domains entry and gets "no access" on the domain addresses', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('admin-active', { signedInAs: 'alice@example.org' })
  await page.goto('domains')
  await expect(page.getByRole('heading', { level: 1, name: 'No access' })).toBeVisible()
  if (isMobile(page)) {
    await page.getByRole('button', { name: 'Toggle navigation' }).click()
    await expect(page.getByRole('dialog').getByRole('link', { name: 'Domains' })).toHaveCount(0)
    await page.keyboard.press('Escape')
  } else {
    await expect(
      page
        .getByRole('navigation', { name: 'Main navigation' })
        .getByRole('link', { name: 'Domains' }),
    ).toHaveCount(0)
  }
  await page.goto('domains/example.org')
  await expect(page.getByRole('heading', { level: 1, name: 'No access' })).toBeVisible()
  const requests = (await mockApi.requests()).filter((request) => request.path.includes('/domains'))
  expect(requests).toHaveLength(0)
  await expectAccessible()
})
