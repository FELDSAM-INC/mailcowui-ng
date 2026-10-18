// UI 002 US6, adding and editing templates (T080) with the classic forms: the add form's fields,
// labels and defaults, a duplicate name, the Default template, changed values with If-Match, the
// outdated handling, the client rules, access, and the page states.
import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { entry, listReady } from '../domains/helpers'

const field = (page: Page, label: string) => page.getByRole('textbox', { name: label, exact: true })

async function updates(mockApi: {
  requests(): Promise<
    {
      operationId: string | null
      status: number
      body?: unknown
      headers: Record<string, string>
    }[]
  >
}) {
  return (await mockApi.requests()).filter(
    (request) => request.operationId === 'updateDomainTemplate' && request.status !== 403,
  )
}

test.describe('add and edit templates', () => {
  test('FR-052 US6-AS1 the add form starts with the defaults; "Tiny" with 5 mailboxes is then listed', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
  }) => {
    await mockApi.use('templates')
    await page.goto('domain-templates')
    await page.getByRole('link', { name: 'Add Template' }).first().click()
    await expect(page.getByRole('heading', { level: 1, name: 'Add Template' })).toBeVisible()
    await expect(field(page, 'Template (required)')).toHaveValue('')
    await expect(field(page, 'Max. possible aliases')).toHaveValue('400')
    await expect(field(page, 'Max. possible mailboxes')).toHaveValue('10')
    await expect(field(page, 'Default mailbox quota')).toHaveCount(0)
    await expect(field(page, 'Max. quota per mailbox (MiB)')).toHaveValue('10240')
    await expect(field(page, 'Total domain quota (MiB)')).toHaveValue('10240')
    await expect(page.getByRole('checkbox', { name: 'Global Address List' })).toBeChecked()
    await expect(page.getByRole('checkbox', { name: 'Active' })).toBeChecked()
    await expect(page.getByPlaceholder('Disabled')).toHaveValue('')
    await expect(field(page, 'Selector')).toHaveValue('dkim')
    await expect(page.getByLabel('DKIM key length (bits)')).toHaveValue('2048')
    await expect(page.getByRole('checkbox', { name: 'Relay this domain' })).not.toBeChecked()
    await expectAccessible()
    await expectNoHorizontalScroll()
    await field(page, 'Template (required)').fill('Tiny')
    await field(page, 'Max. possible mailboxes').fill('5')
    await page
      .locator('[data-sticky-save]')
      .getByRole('button', { name: 'Add', exact: true })
      .click()
    await expect(page).toHaveURL(/\/ng\/domain-templates$/)
    await expect(page.locator('[data-live="polite"]')).toContainText('Added template Tiny')
    await page.getByRole('searchbox', { name: 'Search:' }).fill('tiny')
    await listReady(page)
    await expect(page.locator('[data-entry]')).toHaveCount(1)
    await expect(page.locator('[data-entry]')).toContainText('5')
  })

  test('US6-AS2 a name another template has, in any letter case, is refused on the name field', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('templates')
    await page.goto('domain-templates/new')
    await field(page, 'Template (required)').fill('small')
    await page
      .locator('[data-sticky-save]')
      .getByRole('button', { name: 'Add', exact: true })
      .click()
    await expect(page.locator('#template-add-name-error')).toContainText(
      'Template small already exists',
    )
  })

  test('the client rules: an empty name and a maximum mailbox quota above the domain quota are refused before sending', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('templates')
    await page.goto('domain-templates/new')
    await field(page, 'Max. quota per mailbox (MiB)').fill('20480')
    await page
      .locator('[data-sticky-save]')
      .getByRole('button', { name: 'Add', exact: true })
      .click()
    await expect(page.locator('#template-add-name-error')).toContainText('Template name invalid')
    await expect(page.locator('#template-add-maxMailboxQuota-error')).toBeVisible()
    expect(
      (await mockApi.requests()).filter((r) => r.operationId === 'createDomainTemplate'),
    ).toHaveLength(0)
  })

  test('US6-AS3 FR-054 the Default template: read-only name, values save with only the changes and If-Match', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('templates')
    await page.goto('domain-templates')
    await listReady(page)
    await entry(page, '1').getByRole('link', { name: 'Edit: Default' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Edit object' })).toBeVisible()
    await expect(page.getByRole('main').locator('header')).toContainText('Default')
    await expect(field(page, 'Template (required)')).toHaveAttribute('readonly', '')
    await expect(page.getByText('The Default template cannot be renamed.')).toBeVisible()
    await expect(page.getByRole('button', { name: /Remove/ })).toHaveCount(0)
    await expectAccessible()
    await field(page, 'Max. aliases').fill('300')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.locator('[data-live="polite"]')).toContainText(
      'Changes to template Default have been saved',
    )
    const [update] = await updates(mockApi)
    expect(update!.body).toEqual({ maxAliases: 300 })
    expect(update!.headers['if-match']).toMatch(/^"t/)
    expect(update!.headers['content-type']).toContain('application/merge-patch+json')
  })

  test('FR-054 a template changed elsewhere: the input is kept, the changes are listed, Save again saves', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('templates')
    await page.goto('domain-templates/2')
    await field(page, 'Max. possible mailboxes').fill('6')
    await mockApi.mutateTemplate(2, { maxAliases: 77 })
    await page.getByRole('button', { name: 'Save changes' }).click()
    const notice = page.locator('[data-outdated]')
    await expect(notice).toContainText('Max. aliases: now saved as 77')
    await expect(field(page, 'Max. possible mailboxes')).toHaveValue('6')
    await notice.getByRole('button', { name: 'Save again' }).click()
    await expect(page.locator('[data-live="polite"]')).toContainText(
      'Changes to template Small have been saved',
    )
    const saved = await updates(mockApi)
    expect(saved.at(-1)!.body).toEqual({ maxMailboxes: 6 })
  })

  test('renaming to a name another template has is refused on the name field', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('templates')
    await page.goto('domain-templates/2')
    await field(page, 'Template (required)').fill('RESELLER')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.locator('#template-edit-name-error')).toContainText(
      'Template RESELLER already exists',
    )
  })

  test('US6-AS5 a domain administrator has no access to the add form', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('domain-admin-two-of-ten')
    await page.goto('domain-templates/new')
    await expect(page.getByRole('heading', { level: 1, name: 'No access' })).toBeVisible()
  })

  test('the page states: loading, a failed read with retry, failed capabilities, and FR-004 an unknown template', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('templates', { delays: { getDomainTemplate: 1500 } })
    await page.goto('domain-templates/2')
    await expect(page.locator('[data-page-loading]')).toBeVisible()
    await expect(page.getByRole('main').locator('header')).toContainText('Small')

    await mockApi.use('templates')
    await mockApi.failNext('getDomainTemplate', { status: 500 })
    await page.goto('domain-templates/3')
    await expect(page.getByText('The template could not be loaded.')).toBeVisible()
    await page.getByRole('button', { name: 'Try again' }).click()
    await expect(page.getByRole('main').locator('header')).toContainText('Reseller')

    await mockApi.failNext('getDomainsCapabilities', { status: 500 })
    await page.goto('domain-templates/new')
    await expect(page.getByText('The form could not be loaded.')).toBeVisible()

    await page.goto('domain-templates/999')
    await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
    await page.getByRole('link', { name: 'Back to the domain templates' }).click()
    await expect(page).toHaveURL(/\/ng\/domain-templates$/)
  })
})
