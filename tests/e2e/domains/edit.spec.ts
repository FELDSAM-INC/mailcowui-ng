// UI 002 US3, editing a domain (T056) in the "Edit domain" section, which mirrors the classic
// Domain tab (owner rule 1:1): the usage checks, quotas in MiB, outdated saves, the permission
// matrix, tags as a set, refusals, legacy's success message and the edge cases.
import type { Page } from '@playwright/test'

import { permissionFlags } from '../../mocks/scenarios/accounts'
import { expect, test } from '../fixtures/test'
import { isNarrow, listReady } from './helpers'

const GIB = 1024 ** 3
const SECTION = '#section-domain'

async function openDomain(page: Page, name = 'edit.example') {
  await page.goto(`domains/${name}`)
  await expect(page.getByRole('heading', { level: 1, name: 'Edit domain' })).toBeVisible()
  await expect(page.locator(SECTION)).toBeVisible()
}

async function edit(page: Page) {
  await page.getByRole('button', { name: 'Edit Edit domain' }).click()
  await expect(page.getByRole('heading', { level: 2, name: 'Edit domain' })).toBeFocused()
}

const save = (page: Page) => page.getByRole('button', { name: 'Save changes', exact: true }).click()
const main = (page: Page) => page.getByRole('main')
const field = (page: Page, label: string) =>
  page.locator(SECTION).getByRole('textbox', { name: label, exact: true })

async function patches(mockApi: {
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
    (request) => request.operationId === 'updateDomain' && request.status !== 403,
  )
}

test.describe('edit a domain', () => {
  test('FR-015 the classic Domain tab: legacy labels and order, quotas in MiB, times; the rate limit read-only', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('domain-edit')
    await openDomain(page)
    const section = page.locator(SECTION)
    await expect(section).toContainText('Sender-dependent transports')
    await expect(section).toContainText('None / Inherit')
    await expect(section).toContainText('Max. quota per mailbox (MiB)')
    await expect(section).toContainText('51,200')
    await expect(section).toContainText('Created on:')
    await expect(section).toContainText('Last modified:')
    // UI 006 makes the rate limit editable in its own section (tests/e2e/rate-limits).
    await expect(page.locator('#rate-limit')).toContainText('Disabled')
    await edit(page)
    await expect(field(page, 'Domain quota')).toHaveValue('51200')
    await expect(field(page, 'Max. quota per mailbox (MiB)')).toHaveValue('10240')
    await expectAccessible()
  })

  test('US3-AS1 a mailbox limit below the 8 in use is refused before sending', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('domain-edit')
    await openDomain(page)
    await edit(page)
    await field(page, 'Max. possible mailboxes').fill('5')
    await save(page)
    await expect(main(page).getByText('This is below what is in use: 8.')).toBeVisible()
    expect(await patches(mockApi)).toHaveLength(0)
    await expectAccessible()
  })

  test('US3-AS2 a domain quota below the allocation: refused before sending, or by the API after usage changed', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('domain-edit')
    await openDomain(page)
    await edit(page)
    await field(page, 'Domain quota').fill('20480')
    await save(page)
    await expect(main(page).getByText('This is below what is in use: 30 GiB.')).toBeVisible()
    expect(await patches(mockApi)).toHaveLength(0)

    await openDomain(page, 'stale.example')
    await edit(page)
    await mockApi.mutateDomain('stale.example', { usage: { quotaAllocated: 30 * GIB } as never })
    await field(page, 'Domain quota').fill('20480')
    await save(page)
    await expect(main(page).getByText('This is below what is in use: 30 GiB.')).toBeVisible()
    expect(await patches(mockApi)).toHaveLength(1)
  })

  test('US3-AS3 an outdated save keeps the input, marks the changed values, and saves again or discards', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('domain-edit')
    await openDomain(page)
    await edit(page)
    await field(page, 'Description').fill('Mine')
    await mockApi.mutateDomain('edit.example', { description: 'Theirs', maxAliases: 77 })
    await save(page)
    const notice = main(page).locator('[data-outdated]')
    await expect(notice).toContainText('Description: now saved as Theirs')
    await expect(field(page, 'Description')).toHaveValue('Mine')
    await expectAccessible()
    await page.getByRole('button', { name: 'Save again' }).click()
    await expect(page.locator(SECTION)).toContainText('Mine')
    const saved = await patches(mockApi)
    expect(saved.at(-1)!.body).toEqual({ description: 'Mine' })
    expect(saved[0]!.headers['if-match']).not.toBe(saved.at(-1)!.headers['if-match'])

    await edit(page)
    await field(page, 'Description').fill('Mine again')
    await mockApi.mutateDomain('edit.example', { description: 'Theirs again' })
    await save(page)
    await page.getByRole('button', { name: 'Discard my changes' }).click()
    await expect(field(page, 'Description')).toHaveValue('Theirs again')
  })

  test('US3-AS4 a domain administrator without the flag: description read-only, no limits, quotas or relay options, active disabled', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('domain-admin-no-desc')
    await openDomain(page)
    await expect(page.locator(SECTION)).not.toContainText('Max. aliases')
    await edit(page)
    await expect(field(page, 'Description')).toHaveAttribute('readonly', '')
    await expect(page.locator('#section-domain-maxAliases')).toHaveCount(0)
    await expect(page.locator('#section-domain-relay-backupMx')).toHaveCount(0)
    await expect(page.getByRole('checkbox', { name: 'Active' })).toBeDisabled()
    await expect(page.getByRole('checkbox', { name: 'Global Address List' })).toBeEnabled()
    await page.getByRole('checkbox', { name: 'Global Address List' }).uncheck()
    await save(page)
    const [request] = await patches(mockApi)
    expect(request!.body).toEqual({ globalAddressList: false })
    await expectAccessible()
  })

  test('US3-AS5 removing "a" and adding "c" sends exactly b and c', async ({ page, mockApi }) => {
    await mockApi.use('domain-edit')
    await openDomain(page)
    await edit(page)
    await page.getByRole('button', { name: 'Remove tag a' }).click()
    await page.getByRole('combobox', { name: 'Tags' }).fill('c')
    await page.getByRole('combobox', { name: 'Tags' }).press('Enter')
    await save(page)
    await expect(page.locator(SECTION)).toContainText('b and c')
    const [request] = await patches(mockApi)
    expect(request!.body).toEqual({ tags: ['b', 'c'] })
  })

  test("US3-AS6 FR-036 the relay options are saved as checked and shown as the API normalised them; legacy's success message", async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('domain-edit')
    await openDomain(page)
    await edit(page)
    await page.getByLabel(/^Relay non-existing mailboxes only/).check()
    await expect(page.getByLabel('Relay this domain')).not.toBeChecked()
    await save(page)
    const [request] = await patches(mockApi)
    expect(request!.body).toEqual({ relayUnknownOnly: true })
    await expect(page.locator(`${SECTION} [data-value="backupMx"]`)).toContainText('Yes')
    await expect(page.locator('[data-live="polite"]')).toContainText(
      'Changes to domain edit.example have been saved',
    )
  })

  test('US3-AS8 a description refused as not permitted names it, turns it read-only and keeps the other input', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('domain-admin-desc')
    await openDomain(page)
    await edit(page)
    await field(page, 'Description').fill('Mine')
    await mockApi.patch({
      accounts: {
        reseller: {
          permissions: permissionFlags(true, {
            syncjobs: true,
            bccMaps: false,
            loginAs: false,
            domainDesc: false,
          }),
        },
      },
    })
    await save(page)
    await expect(main(page).getByText('You may not change:', { exact: false })).toBeVisible()
    await expect(field(page, 'Description')).toHaveAttribute('readonly', '')
  })

  test('FR-029 FR-038 full screen with sticky actions on phones, in place on desktop; Back asks when changed', async ({
    page,
    mockApi,
    expectNoHorizontalScroll,
  }) => {
    await mockApi.use('domain-edit')
    await openDomain(page)
    await edit(page)
    await expect(page).toHaveURL(/edit=domain/)
    if (isNarrow(page)) {
      await expect(page.locator(SECTION)).toHaveAttribute('data-layout', 'full')
      await expect(page.locator(`${SECTION} [data-section-actions]`)).toHaveClass(/sticky/)
      await expect(page.locator('#rate-limit')).toHaveCount(0)
    } else {
      await expect(page.locator(SECTION)).toHaveAttribute('data-layout', 'inline')
    }
    await expectNoHorizontalScroll()
    await field(page, 'Description').fill('Changed')
    await page.goBack()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toContainText('Leave without saving?')
    await dialog.getByRole('button', { name: 'Stay' }).click()
    await expect(page).toHaveURL(/edit=domain/)
    await page.getByRole('button', { name: 'Cancel' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Leave' }).click()
    await expect(page).not.toHaveURL(/edit=/)
    await expect(page.locator(SECTION)).toContainText('Edit Ltd')
  })

  test('FR-030 only the changed members are sent, with If-Match; quotas in MiB become bytes', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('domain-edit')
    await openDomain(page)
    await edit(page)
    await field(page, 'Max. aliases').fill('500')
    await field(page, 'Domain quota').fill('61440')
    await save(page)
    await expect(page.locator(SECTION)).toContainText('500')
    const [request] = await patches(mockApi)
    expect(request!.body).toEqual({ maxAliases: 500, domainQuota: 60 * GIB })
    expect(request!.headers['if-match']).toMatch(/^".+"$/)
    expect(request!.headers['content-type']).toBe('application/merge-patch+json')
  })

  test('FR-031 FR-032 quota rules before sending: the largest mailbox, whole MiB, the order and the description length', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('domain-edit')
    await openDomain(page)
    await edit(page)
    await field(page, 'Max. quota per mailbox (MiB)').fill('4096')
    await save(page)
    await expect(main(page).getByText('This is below what is in use: 5 GiB.')).toBeVisible()
    await field(page, 'Max. quota per mailbox (MiB)').fill('1.5')
    await save(page)
    await expect(page.locator('#section-domain-maxMailboxQuota-error')).toBeVisible()
    await field(page, 'Max. quota per mailbox (MiB)').fill('61440')
    await save(page)
    await expect(page.locator('#section-domain-maxMailboxQuota-error')).toBeVisible()
    await field(page, 'Max. quota per mailbox (MiB)').fill('6144')
    await field(page, 'Description').fill('x'.repeat(256))
    await save(page)
    await expect(main(page).getByText('Enter at most 255 characters.')).toBeVisible()
    expect(await patches(mockApi)).toHaveLength(0)
  })

  test('FR-079 after a save, the list shows the new values at once', async ({ page, mockApi }) => {
    await mockApi.use('domain-edit')
    await page.goto('domains')
    await listReady(page)
    await page.locator('[data-entry="edit.example"] a').first().click()
    await edit(page)
    await field(page, 'Max. possible mailboxes').fill('20')
    await save(page)
    await expect(page.locator(SECTION)).toContainText('20')
    await page.goBack()
    await expect(page.locator('[data-list-loading]')).toHaveCount(0)
    await expect(
      page.locator('[data-entry="edit.example"] [data-usage="mailboxes"]'),
    ).toContainText('8 of 20')
  })

  test('FR-039 FR-040 tag entry, trimming, case duplicates, length and the limit of 25; a set above it can shrink', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('domain-edit')
    await openDomain(page)
    await edit(page)
    const input = page.getByRole('combobox', { name: 'Tags' })
    await input.fill('  spaced  ')
    await input.press('Enter')
    await input.fill('A,')
    await input.fill(Array.from({ length: 23 }, (_, i) => `more-${i}`).join(','))
    await input.press('Enter')
    await save(page)
    await expect(main(page).getByText('Enter at most 25 entries.')).toBeVisible()
    expect(await patches(mockApi)).toHaveLength(0)

    await mockApi.use('domain-tags-over-limit')
    await openDomain(page, 'tags.example')
    await edit(page)
    await page.getByRole('button', { name: 'Remove tag tag-01' }).click()
    await save(page)
    await expect(page.locator(SECTION)).not.toContainText('tag-01')
  })

  test('No confirmation legacy lacks: deactivating saves at once', async ({ page, mockApi }) => {
    await mockApi.use('domain-edit')
    await openDomain(page)
    await edit(page)
    await page.getByRole('checkbox', { name: 'Active' }).uncheck()
    await save(page)
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    await expect(page.locator(`${SECTION} [data-value="active"]`)).toContainText('No')
  })

  test('Edge: usage above a limit still lets other settings save, and the limit only at 12 or more; zero limits save', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('domain-usage-over-limit')
    await openDomain(page, 'over.example')
    await edit(page)
    await field(page, 'Max. aliases').fill('0')
    await save(page)
    await expect(page.locator(`${SECTION} [data-value="maxAliases"]`)).toContainText('0')
    await edit(page)
    await field(page, 'Max. possible mailboxes').fill('11')
    await save(page)
    await expect(main(page).getByText('This is below what is in use: 12.')).toBeVisible()
    await field(page, 'Max. possible mailboxes').fill('12')
    await save(page)
    await expect(page.locator(`${SECTION} [data-value="maxMailboxes"]`)).toContainText('12')
  })

  test('Edge: a domain removed meanwhile says it is no longer available, with a link to the list', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('domain-edit')
    await openDomain(page)
    await edit(page)
    await field(page, 'Description').fill('Gone')
    await mockApi.removeDomain('edit.example')
    await save(page)
    await expect(
      main(page).getByText('This domain no longer exists or is no longer available to you.'),
    ).toBeVisible()
    await expect(main(page).getByRole('link', { name: 'Back to the domains' })).toBeVisible()
  })

  test('Edge: a lost connection and a server error say nothing was saved, and the retry keeps the input', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('domain-edit')
    await openDomain(page)
    await edit(page)
    await field(page, 'Description').fill('Retry me')
    await page.route('**/api/v2/domains/edit.example', (route) =>
      route.request().method() === 'PATCH' ? route.abort() : route.continue(),
    )
    await save(page)
    await expect(main(page).getByText('Nothing was saved.', { exact: false })).toBeVisible()
    await expect(field(page, 'Description')).toHaveValue('Retry me')
    await page.unroute('**/api/v2/domains/edit.example')
    await mockApi.failNext('updateDomain', { status: 500 })
    await page.getByRole('button', { name: 'Try again' }).click()
    await expect(main(page).getByText('Nothing was saved.', { exact: false })).toBeVisible()
    await page.getByRole('button', { name: 'Try again' }).click()
    await expect(page.locator(SECTION)).toContainText('Retry me')
  })

  test('Edge: usage changes alone never make a save outdated', async ({ page, mockApi }) => {
    await mockApi.use('domain-edit')
    await openDomain(page)
    await edit(page)
    await field(page, 'Description').fill('Usage moved')
    await mockApi.mutateDomain('edit.example', {
      usage: { storageUsed: 20 * GIB, messages: 5000 } as never,
    })
    await save(page)
    await expect(page.locator(SECTION)).toContainText('Usage moved')
    await expect(page.locator('[data-outdated]')).toHaveCount(0)
  })
})
