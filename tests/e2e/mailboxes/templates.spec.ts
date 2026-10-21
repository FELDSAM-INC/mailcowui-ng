// UI 003 US7, the mailbox templates (T103) with the classic list and forms (owner rule 1:1): the
// navigation entry for both roles, the classic columns as cards and table, search, sort and paging
// in the address, the list states, the add form with the built-in defaults, a duplicate name, the
// Default template, changed values only with If-Match, the outdated handling, single and mass
// removal, read-only access for domain administrators, the groupware switch, one request per
// double tap, and History for administrators.
import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { openNavigation } from '../fixtures/flows'
import { entry, isNarrow, listReady, resultCount } from '../domains/helpers'

const GIB = 1024 ** 3

const field = (page: Page, label: string) => page.getByRole('textbox', { name: label, exact: true })
const addButton = (page: Page) =>
  page.locator('[data-sticky-save]').getByRole('button', { name: 'Add', exact: true })
const live = (page: Page) => page.locator('[data-live="polite"]')

type Requests = {
  requests(): Promise<
    {
      operationId: string | null
      status: number
      body?: unknown
      headers: Record<string, string>
    }[]
  >
}

async function requestsOf(mockApi: Requests, operationId: string) {
  return (await mockApi.requests()).filter((request) => request.operationId === operationId)
}

async function openNavEntry(page: Page) {
  await page.goto('')
  const navigation = await openNavigation(page)
  await navigation.getByRole('link', { name: 'Mailboxes', exact: true }).click()
  await expect(
    page.getByRole('heading', { level: 1, name: 'Mailboxes', exact: true }),
  ).toBeVisible()
  const tabs = page.locator('[data-section-navigation]')
  if (await tabs.getByRole('button').isVisible()) await tabs.getByRole('button').click()
  await tabs.getByRole('link', { name: 'Mailbox Templates', exact: true }).click()
  await expect(page).toHaveURL(/\/ng\/mailbox-templates$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Mailbox Templates' })).toBeVisible()
}

test.describe('mailbox templates', () => {
  test('US7-AS1 FR-001 FR-058 the navigation entry; 33 templates by name with Default marked and the classic columns', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
    expectTouchTargets,
  }) => {
    await mockApi.use('admin-templates')
    await openNavEntry(page)
    await listReady(page)
    expect(await resultCount(page)).toBe('Templates found: 33')
    await expect(page.locator('[data-entry]')).toHaveCount(25)
    await expect(entry(page, '1').locator('[data-default-badge]')).toHaveText('Default')
    await expectAccessible()
    await expectNoHorizontalScroll()

    await page.goto('mailbox-templates?q=staff')
    await listReady(page)
    const staff = entry(page, '3')
    if (isNarrow(page)) {
      await expect(staff.getByRole('heading', { level: 3, name: 'Staff' })).toBeVisible()
      await expect(staff.locator('[data-column="quota"]')).toContainText('5 GiB')
      await expect(staff.locator('[data-column="protocols"]')).toContainText('SMTP, IMAP')
      await expect(staff.locator('[data-column="protocols"]')).not.toContainText('POP3')
      await expect(staff.locator('[data-column="forceSecondFactorSetup"]')).toContainText('Yes')
    } else {
      for (const name of ['ID', 'Template', 'Quota', 'Active', 'Action']) {
        await expect(page.getByRole('columnheader', { name, exact: true })).toBeVisible()
      }
      await expect(staff.locator('[data-column="quota"]')).toHaveText('5 GiB')
    }
    await expect(staff.locator('[data-column="status"]')).toContainText('Inactive')
    await staff.getByRole('button', { name: 'Details of Staff' }).click()
    const details = page.locator('[data-entry-details="3"]')
    await expect(details.locator('[data-column="quarantineNotification"]')).toContainText('Daily')
    await expect(details.locator('[data-column="quarantineCategory"]')).toContainText(
      'All categories',
    )
    await expect(details.locator('[data-column="rateLimit"]')).toContainText('100 msgs / hour')
    await expect(details.locator('[data-column="tags"]')).toContainText('staff')
    await expect(details.locator('[data-column="tags"]')).toContainText('office')
    await expectAccessible()
    if (isNarrow(page)) await expectTouchTargets()

    await page.goto('mailbox-templates?q=default')
    await listReady(page)
    await entry(page, '1').getByRole('button', { name: 'Details of Default' }).click()
    await expect(page.locator('[data-entry-details="1"] [data-column="rateLimit"]')).toContainText(
      '∞',
    )
  })

  test('FR-002 FR-058 the search, every sort key, the order and the page size are in the address', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('admin-templates')
    await page.goto('mailbox-templates')
    await listReady(page)
    await page.getByRole('searchbox', { name: 'Search:' }).fill('pack')
    await expect(page).toHaveURL(/q=pack/)
    await expect(page.locator('[data-result-count]')).toHaveText('Templates found: 30')
    for (const [value, label] of [
      ['id', 'ID'],
      ['createdAt', 'Created on'],
      ['modifiedAt', 'Last modified'],
      ['name', 'Template'],
    ]) {
      await page.getByLabel('Sort by').selectOption({ label })
      await expect(page).toHaveURL(value === 'name' ? /^(?!.*sort=)/ : new RegExp(`sort=${value}`))
    }
    await page.getByLabel('Order').selectOption('desc')
    await expect(page).toHaveURL(/order=desc/)
    await expect(page.locator('[data-entry]').first()).toHaveAttribute('data-entry', '33')
    await page.locator('[data-page-size] select').selectOption('50')
    await expect(page).toHaveURL(/size=50/)
  })

  test('FR-065 the loading state, no matches, and an error with retry', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('admin-templates', { delays: { listMailboxTemplates: 1500 } })
    await page.goto('mailbox-templates')
    await expect(page.locator('[data-list-loading]')).toBeVisible()
    await listReady(page)

    await mockApi.use('admin-templates')
    await page.goto('mailbox-templates?q=nothing-like-this')
    await expect(page.getByText('No matching records found')).toBeVisible()
    await page.getByRole('button', { name: 'Clear search' }).last().click()
    await expect(page).not.toHaveURL(/q=/)
    await listReady(page)

    await mockApi.use('mailbox-templates-list-error')
    await page.goto('mailbox-templates')
    await expect(page.getByText('The list could not be loaded.')).toBeVisible()

    await mockApi.use('admin-templates')
    await mockApi.failNext('listMailboxTemplates', { status: 500 })
    await page.goto('mailbox-templates')
    await expect(page.getByText('The list could not be loaded.')).toBeVisible()
    await page.getByRole('button', { name: 'Try again' }).click()
    await expect(page.locator('[data-result-count]')).toHaveText('Templates found: 33')
  })

  test('US7-AS2 FR-059 "Students" added unchanged holds exactly the built-in defaults the form showed', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
  }) => {
    await mockApi.use('admin-templates')
    await page.goto('mailbox-templates')
    await page.getByRole('link', { name: 'Add Template' }).first().click()
    await expect(page.getByRole('heading', { level: 1, name: 'Add Template' })).toBeVisible()
    await expect(field(page, 'Template (required)')).toHaveValue('')
    await expect(field(page, 'Quota (MiB)')).toHaveValue('0')
    await expect(page.getByText('0 = ∞')).toBeVisible()
    await expect(page.getByRole('radio', { name: 'Hourly' })).toBeChecked()
    await expect(page.getByPlaceholder('Disabled')).toHaveValue('')
    await expect(page.getByRole('checkbox', { name: 'Direct forwarding to SOGo' })).toBeChecked()
    await expect(page.getByRole('listbox', { name: 'ACL' })).toBeVisible()
    await expectAccessible()
    await expectNoHorizontalScroll()
    await field(page, 'Template (required)').fill('Students')
    await addButton(page).click()
    await expect(page).toHaveURL(/\/ng\/mailbox-templates$/)
    await expect(live(page)).toContainText('Added template Students')
    const [created] = await requestsOf(mockApi, 'createMailboxTemplate')
    expect(created!.body).toEqual({
      name: 'Students',
      quota: 0,
      status: 'active',
      forcePasswordChange: false,
      forceSecondFactorSetup: false,
      webmailRedirect: true,
      protocolAccess: {
        imap: true,
        pop3: true,
        smtp: true,
        sieve: true,
        activeSync: true,
        dav: true,
      },
      userPermissions: {
        spamAlias: true,
        tlsPolicy: true,
        spamScore: true,
        spamPolicy: true,
        delimiterAction: true,
        syncjobs: false,
        easReset: true,
        sogoProfileReset: false,
        pushover: true,
        quarantine: true,
        quarantineAttachments: true,
        quarantineNotification: true,
        quarantineCategory: true,
        appPasswds: true,
        pwReset: true,
      },
      tags: [],
      taggedMailHandling: 'none',
      quarantineNotification: 'hourly',
      quarantineCategory: 'rejected',
      tlsEnforceInbound: false,
      tlsEnforceOutbound: false,
      rateLimit: null,
    })
    await page.getByRole('searchbox', { name: 'Search:' }).fill('students')
    await expect(page.locator('[data-entry]')).toHaveCount(1)
  })

  test('US7-AS3 FR-060 "staff" is refused on the name field; an empty name before sending', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('admin-templates')
    await page.goto('mailbox-templates/new')
    await addButton(page).click()
    await expect(page.locator('#template-add-name-error')).toContainText('Template name invalid')
    expect(await requestsOf(mockApi, 'createMailboxTemplate')).toHaveLength(0)
    await field(page, 'Template (required)').fill('staff')
    await addButton(page).click()
    await expect(page.locator('#template-add-name-error')).toContainText(
      'Template staff already exists',
    )
  })

  test('US7-AS4 US7-AS5 FR-061 Default: a read-only name with the reason and no Remove; only the quota is sent', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('admin-templates')
    await page.goto('mailbox-templates?sort=id')
    await listReady(page)
    await expect(entry(page, '1').getByRole('button', { name: /^Remove/ })).toHaveCount(0)
    await entry(page, '1').getByRole('link', { name: 'Edit: Default' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Edit object' })).toBeVisible()
    await expect(page.getByRole('main').locator('header')).toContainText('Default')
    await expect(field(page, 'Template (required)')).toHaveAttribute('readonly', '')
    await expect(page.getByText('The Default template cannot be renamed.')).toBeVisible()
    await expect(page.getByRole('button', { name: /Remove/ })).toHaveCount(0)
    await expectAccessible()
    await field(page, 'Quota (MiB)').fill('2048')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(live(page)).toContainText('Changes to template Default have been saved')
    const [update] = (await requestsOf(mockApi, 'updateMailboxTemplate')).filter(
      (request) => request.status === 200,
    )
    expect(update!.body).toEqual({ quota: 2 * GIB })
    expect(update!.headers['if-match']).toMatch(/^"t/)
    expect(update!.headers['content-type']).toContain('application/merge-patch+json')
  })

  test('FR-061 FR-044 a template changed elsewhere: the input is kept, the changes are listed, Save again saves', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('admin-templates')
    await page.goto('mailbox-templates/2')
    await field(page, 'Quota (MiB)').fill('3072')
    await mockApi.patch({ mailboxTemplates: { set: { '2': { quarantineNotification: 'daily' } } } })
    await page.getByRole('button', { name: 'Save changes' }).click()
    const notice = page.locator('[data-outdated]')
    await expect(notice).toContainText('Quarantine notifications: now saved as Daily')
    await expect(field(page, 'Quota (MiB)')).toHaveValue('3072')
    await expectAccessible()
    await notice.getByRole('button', { name: 'Save again' }).click()
    await expect(live(page)).toContainText('Changes to template Small have been saved')
    const updates = await requestsOf(mockApi, 'updateMailboxTemplate')
    expect(updates.map((request) => request.status)).toEqual([412, 200])
    expect(updates.at(-1)!.body).toEqual({ quota: 3 * GIB })
  })

  test('US7-AS6 FR-062 removing a template names it and says mailboxes keep their values', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('admin-templates')
    await page.goto('mailbox-templates?sort=id')
    await listReady(page)
    await entry(page, '2').getByRole('button', { name: 'Actions for Small' }).click()
    await page.getByRole('menuitem', { name: 'Remove: Small' }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog.getByRole('heading', { name: 'Confirm deletion' })).toBeVisible()
    await expect(dialog).toContainText('Please confirm your changes to the following object id')
    await expect(dialog).toContainText('Small')
    await expect(dialog).toContainText('Mailboxes created from this template keep their values.')
    await expectAccessible()
    await dialog.getByRole('button', { name: 'Delete now' }).dblclick()
    await expect(entry(page, '2')).toHaveCount(0)
    await expect(live(page)).toContainText('Template ID 2 has been deleted')
    const deletions = await requestsOf(mockApi, 'deleteMailboxTemplate')
    expect(deletions).toHaveLength(1)
    expect(deletions[0]!.headers['if-match']).toMatch(/^"t/)
  })

  test('FR-044 a removal refused as outdated reloads the template and asks again', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('admin-templates')
    await page.goto('mailbox-templates?sort=id')
    await listReady(page)
    await mockApi.patch({ mailboxTemplates: { set: { '2': { quota: 2 * GIB } } } })
    await entry(page, '2').getByRole('button', { name: 'Actions for Small' }).click()
    await page.getByRole('menuitem', { name: 'Remove: Small' }).click()
    const dialog = page.getByRole('alertdialog')
    await dialog.getByRole('button', { name: 'Delete now' }).click()
    await expect(dialog).toContainText('The template changed in the meantime.')
    await dialog.getByRole('button', { name: 'Delete now' }).click()
    await expect(entry(page, '2')).toHaveCount(0)
    const deletions = await requestsOf(mockApi, 'deleteMailboxTemplate')
    expect(deletions.map((request) => request.status)).toEqual([412, 204])
  })

  test('G39 removing selected templates: Default not selectable, the count typed, one request and a row each', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('admin-templates')
    await page.goto('mailbox-templates?sort=id')
    await listReady(page)
    await page.getByRole('button', { name: 'Select', exact: true }).click()
    await expect(page.getByRole('checkbox', { name: 'Select Default' })).toHaveCount(0)
    for (const name of ['Small', 'Staff', 'Package 01']) {
      await page.getByRole('checkbox', { name: `Select ${name}` }).check()
    }
    const bar = page.getByRole('region', { name: 'Bulk actions' })
    await expect(bar).toContainText('3 selected')
    await mockApi.patch({ mailboxTemplates: { set: { '3': { quota: GIB } }, remove: [4] } })
    await bar.getByRole('button', { name: 'Remove' }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toContainText('Confirm deletion')
    await expect(dialog).toContainText('Package 01')
    await expect(dialog).toContainText('Mailboxes created from these templates keep their values.')
    const confirm = dialog.getByRole('button', { name: 'Delete now' })
    await expect(confirm).toBeDisabled()
    await expectAccessible()
    await dialog.getByRole('textbox').fill('3')
    await confirm.click()
    const results = page.getByRole('region', { name: 'Results' })
    await expect(results.locator('li', { hasText: 'Done' })).toHaveCount(1)
    await expect(results.locator('li', { hasText: 'Changed in the meantime' })).toContainText(
      'Staff',
    )
    await expect(results.locator('li', { hasText: 'Not found' })).toContainText('Package 01')
    await expect(bar).toContainText('1 selected')
    const requests = await requestsOf(mockApi, 'applyMailboxTemplateBulkAction')
    expect(requests).toHaveLength(1)
    expect((requests[0]!.body as { targets: { version: string }[] }).targets).toHaveLength(3)
    await results.getByRole('button', { name: 'Retry the failed ones' }).click()
    await expect(entry(page, '3')).toHaveCount(0)
  })

  test('US7-AS7 FR-063 a domain administrator reads every template without controls and has no add form', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('domain-admin-templates')
    await openNavEntry(page)
    await listReady(page)
    await expect(page.getByRole('link', { name: 'Add Template' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Select', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^Remove/ })).toHaveCount(0)
    await expect(page.getByRole('link', { name: /^Edit:/ })).toHaveCount(0)
    await page.goto('mailbox-templates/3')
    await expect(page.getByRole('main').locator('header')).toContainText('Staff')
    const values = page.locator('[data-template-values]')
    await expect(values.locator('[data-value="quota"]')).toContainText('5 GiB')
    await expect(values.locator('[data-value="userPermissions"]')).not.toContainText('Sync jobs')
    await expect(values.locator('[data-value="rateLimit"]')).toContainText('100 msgs / hour')
    await expect(page.getByRole('textbox')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Save changes' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'History' })).toHaveCount(0)
    await expectAccessible()
    await page.goto('mailbox-templates/new')
    await expect(page.getByRole('heading', { level: 1, name: 'No access' })).toBeVisible()
  })

  test('FR-059 FR-031 with the groupware off, SOGo access is not offered', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('capabilities-groupware-off-templates')
    await page.goto('mailbox-templates/new')
    await expect(field(page, 'Template (required)')).toBeVisible()
    await expect(
      page.getByRole('checkbox', { name: 'Force 2FA enrollment at login' }),
    ).toBeVisible()
    await expect(page.getByRole('checkbox', { name: 'Direct forwarding to SOGo' })).toHaveCount(0)
    await page.goto('mailbox-templates/2')
    await expect(field(page, 'Quota (MiB)')).toBeVisible()
    await expect(page.getByRole('checkbox', { name: 'Direct forwarding to SOGo' })).toHaveCount(0)
  })

  test('FR-066 a double tap on Add or Save sends one request', async ({ page, mockApi }) => {
    await mockApi.use('admin-templates', {
      delays: { createMailboxTemplate: 500, updateMailboxTemplate: 500 },
    })
    await page.goto('mailbox-templates/new')
    await field(page, 'Template (required)').fill('Twice')
    await addButton(page).dblclick()
    await expect(page).toHaveURL(/\/ng\/mailbox-templates$/)
    expect(await requestsOf(mockApi, 'createMailboxTemplate')).toHaveLength(1)
    await page.goto('mailbox-templates/2')
    await field(page, 'Quota (MiB)').fill('512')
    await page.getByRole('button', { name: 'Save changes' }).dblclick()
    await expect(live(page)).toContainText('Changes to template Small have been saved')
    expect(await requestsOf(mockApi, 'updateMailboxTemplate')).toHaveLength(1)
  })

  test('History for administrators, and FR-004 an unknown template', async ({ page, mockApi }) => {
    await mockApi.use('admin-templates')
    await page.goto('mailbox-templates/2')
    const history = page.getByRole('link', { name: 'History' })
    await expect(history).toHaveAttribute('href', /targetType=mailboxTemplate/)
    await expect(history).toHaveAttribute('href', /targetId=2/)
    await page.getByRole('link', { name: 'Previous page' }).click()
    await expect(page).toHaveURL(/\/ng\/mailbox-templates$/)

    await page.goto('mailbox-templates/999')
    await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
    await page.getByRole('link', { name: 'Back to the mailbox templates' }).click()
    await expect(page).toHaveURL(/\/ng\/mailbox-templates$/)
  })
})
