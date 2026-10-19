// UI 009 US2, the relayhost of a domain and a mailbox in its legacy position (T040; legacy form map
// decision 12): legacy's searchable choice of `ID n: host (username)` and "None / Inherit" in UI
// 002's Domain section and UI 003's Mailbox section, saved with the section's Save through the
// assignment operation, hidden without the flag as legacy hides it, outdated saves and refusals.
import type { Page } from '@playwright/test'

import { permissionFlags } from '../../mocks/scenarios/accounts'
import { expect, test } from '../fixtures/test'
import { entry, listReady, polite } from './helpers'

async function openDomainForm(page: Page, name = 'example.org') {
  await page.goto(`domains/${name}?edit=domain`)
  await expect(page.getByRole('heading', { level: 2, name: 'Edit domain' })).toBeVisible()
}

async function openMailboxForm(page: Page, address: string) {
  await page.goto(`mailboxes/${address}?edit=mailbox`)
  await expect(page.locator('#section-mailbox form')).toBeVisible()
}

const choice = (page: Page) => page.getByRole('combobox', { name: 'Sender-dependent transports' })

async function choose(page: Page, option: RegExp | string) {
  await choice(page).click()
  await page.getByRole('option', { name: option }).click()
}

const save = (page: Page) =>
  page.getByRole('button', { name: 'Save changes', exact: true }).first().click()

test.describe('relayhost assignments', () => {
  test('US2-AS1 FR-029 FR-032 an administrator chooses a relayhost for a domain and saves the section', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('routing-assignments')
    await openDomainForm(page)
    await expect(choice(page)).toHaveValue('ID 1: [smtp.example.net]:587')
    await choice(page).click()
    const options = page.getByRole('option')
    await expect(options.first()).toHaveText('None / Inherit')
    await expect(
      page.getByRole('option', { name: /ID 4: \[smarthost.example\]:587 \(alpha\)/ }),
    ).toBeVisible()
    await expect(page.getByRole('option', { name: /ID 3: .*Inactive/ })).toBeVisible()
    await expectAccessible()
    await page.getByRole('option', { name: /ID 4:/ }).click()
    await save(page)
    await expect(polite(page)).toContainText('Changes to domain example.org have been saved')
    const requests = await mockApi.requests()
    const put = requests.find((item) => item.operationId === 'replaceDomainRelayhostAssignment')!
    expect(put.body).toEqual({ relayhostId: 4 })
    expect(put.headers['if-match']).toBeTruthy()
    expect(requests.some((item) => item.operationId === 'updateDomain')).toBe(false)
    await page.goto('routing/relayhosts')
    await listReady(page)
    await expect(entry(page, 4)).toContainText('Domains: 1')
  })

  test('US2-AS3 FR-030 a domain administrator with the mailbox flag assigns a mailbox relayhost', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('routing-da-assignments')
    await openMailboxForm(page, 'alice@example.org')
    await expect(page.getByText('Applied to the mailbox and direct aliases only')).toBeVisible()
    await choose(page, /ID 4:/)
    await expectAccessible()
    await save(page)
    await expect(polite(page)).toContainText('alice@example.org')
    const put = (await mockApi.requests()).find(
      (item) => item.operationId === 'replaceMailboxRelayhostAssignment',
    )!
    expect(put.body).toEqual({ relayhostId: 4 })
  })

  test('US2-AS5 FR-034 a dangling assignment shows its identifier and can be cleared', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('routing-assignments')
    await openMailboxForm(page, 'carol@example.net')
    await expect(choice(page)).toHaveValue('ID 99')
    await choose(page, 'None / Inherit')
    await save(page)
    const put = (await mockApi.requests()).find(
      (item) => item.operationId === 'replaceMailboxRelayhostAssignment',
    )!
    expect(put.body).toEqual({ relayhostId: null })
  })

  test('US2-AS7 FR-036 without relayhosts only "None / Inherit" is offered', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('routing-no-relayhosts')
    await openDomainForm(page)
    await choice(page).click()
    await expect(page.getByRole('option')).toHaveText(['None / Inherit'])
  })

  test('US2-AS6 FR-014 an assignment changed meanwhile is reported, the choice kept, and saved again', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('routing-assignments')
    await openDomainForm(page)
    await expect(choice(page)).toHaveValue('ID 1: [smtp.example.net]:587')
    await choose(page, /ID 5:/)
    await mockApi.mutateDomain('example.org', {
      relayhost: { id: 2, hostname: 'relay.example.com' },
    })
    await save(page)
    const notice = page.locator('[data-outdated]')
    await expect(notice).toContainText(
      'Sender-dependent transports: now saved as ID 2: relay.example.com',
    )
    await expect(choice(page)).toHaveValue(/ID 5:/)
    await page.getByRole('button', { name: 'Save again' }).click()
    await expect(polite(page)).toContainText('Changes to domain example.org have been saved')
  })

  test('FR-031 SC-010 without the flag the choice is hidden, as legacy hides it', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('routing-da-mailbox-flag-only')
    await openDomainForm(page)
    await expect(choice(page)).toHaveCount(0)
    await expect(page.locator('#section-domain')).not.toContainText('Sender-dependent transports')
    await openMailboxForm(page, 'alice@example.org')
    await expect(choice(page)).toBeVisible()
    await mockApi.use('routing-da-readonly')
    await openMailboxForm(page, 'alice@example.org')
    await expect(choice(page)).toHaveCount(0)
    const requests = await mockApi.requests()
    expect(requests.some((item) => item.operationId === 'getMailboxRelayhostAssignment')).toBe(
      false,
    )
  })

  test('Edge: a flag removed meanwhile makes the save show the refusal at the field', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('routing-da-assignments')
    await openDomainForm(page)
    await choose(page, /ID 2:/)
    await mockApi.patch({
      accounts: {
        reseller: {
          permissions: permissionFlags(true, { loginAs: false, domainRelayhost: false }),
        },
      },
    })
    await save(page)
    await expect(
      page.locator('#section-domain').getByText('Access denied or invalid form data'),
    ).toBeVisible()
  })

  test('FR-012 leaving the section with a changed relayhost asks first', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('routing-assignments')
    await openDomainForm(page)
    await expect(choice(page)).toHaveValue('ID 1: [smtp.example.net]:587')
    await choose(page, /ID 2:/)
    await page.evaluate(() => {
      window.history.pushState({}, '', '/ng/routing')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    await expect(page.getByRole('alertdialog', { name: 'Leave without saving?' })).toBeVisible()
  })
})
