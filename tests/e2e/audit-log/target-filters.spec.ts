// UI 002 US8, the audit log's target filters (T097, FR-063, research D26): the translated target
// types, a target filter by type and identifier that narrows the list, both as removable chips that
// survive a reload, and the API key page's History link.
import type { Locator, Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { HISTORY_KEY } from '../../mocks/scenarios/domains-history'

const wide = (page: Page) => (page.viewportSize()?.width ?? 0) >= 768

async function filters(page: Page): Promise<Locator> {
  const toggle = page.getByRole('button', { name: 'Filters', exact: true })
  if ((await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click()
  return page.getByRole('form', { name: 'Filters' })
}

function records(page: Page): Locator {
  return wide(page)
    ? page.getByRole('table', { name: 'Audit records' }).locator('tbody > tr[data-record]')
    : page.getByRole('list', { name: 'Audit records' }).getByRole('listitem')
}

const summary = (page: Page) => page.getByText(/^Showing \d+ to \d+ of \d+ entries$/)

test.describe('audit log target filters', () => {
  test('FR-063 the target type lists translated types; type and ID narrow the list as chips that survive a reload', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
  }) => {
    await mockApi.use('audit-domain-records')
    await page.goto('audit-log')
    await expect(summary(page)).toHaveText('Showing 1 to 10 of 10 entries')
    const form = await filters(page)
    const type = form.getByLabel('Target type')
    const options = await type.locator('option').allTextContents()
    expect(options).toEqual(
      expect.arrayContaining([
        'Any target type',
        'API key',
        'Domain',
        'Domain wide footer',
        'Domain template',
      ]),
    )
    await type.selectOption('domain')
    await form.getByLabel('Target', { exact: true }).fill('EXAMPLE.ORG')
    await expectAccessible()
    await form.getByRole('button', { name: 'Apply filters' }).click()
    await expect(summary(page)).toHaveText('Showing 1 to 3 of 3 entries')
    await expect(page).toHaveURL(/targetType=domain&targetId=EXAMPLE\.ORG/)
    const typeChip = page.getByRole('button', { name: 'Remove filter: Domain', exact: true })
    const idChip = page.getByRole('button', { name: 'Remove filter: Target: EXAMPLE.ORG' })
    await expect(typeChip).toBeVisible()
    await expect(idChip).toBeVisible()
    await page.reload()
    await expect(summary(page)).toHaveText('Showing 1 to 3 of 3 entries')
    await expect(idChip).toBeVisible()
    await typeChip.click()
    await expect(summary(page)).toHaveText('Showing 1 to 4 of 4 entries')
    await idChip.click()
    await expect(summary(page)).toHaveText('Showing 1 to 10 of 10 entries')
    await expectNoHorizontalScroll()
  })

  test('research D26 the API key page has History, opening the records of the key', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('audit-domain-records')
    await page.goto(`api-keys/${HISTORY_KEY.id}`)
    await page.getByRole('link', { name: 'History' }).click()
    await expect(page).toHaveURL(
      new RegExp(`/ng/audit-log\\?targetType=apiKey&targetId=${HISTORY_KEY.id}$`),
    )
    await expect(summary(page)).toHaveText('Showing 1 to 1 of 1 entries')
    await expect(records(page).first()).toContainText('API key created')
  })
})
