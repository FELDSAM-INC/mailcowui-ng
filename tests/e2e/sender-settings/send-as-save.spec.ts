// UI 004 US5, saving "Allow to send as" and the external sender addresses with the Mailbox section
// (T072): granting a blocked alias, "*", refused entries kept and marked, entries not needed, whole
// sets with If-Match, the domain administrator's entries kept, conflicts, refreshed permissions,
// the leave guard and a network failure.
import { SENDER_004 } from '../../mocks/scenarios/sender-settings'
import { expect, test } from '../fixtures/test'
import { choose, entry, MAILBOX_PAGE, openMailboxSection, saveButton } from './helpers'

type Requests = {
  requests(): Promise<
    { operationId: string | null; body?: unknown; headers: Record<string, string> }[]
  >
}
const saves = async (mockApi: Requests) =>
  (await mockApi.requests()).filter((r) => r.operationId === 'updateMailboxSenderSettings')

test.describe('send as: saving', () => {
  test('US5-AS2 FR-054 allowing a blocked alias sends the whole set with If-Match and lists it', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('sender-settings')
    await openMailboxSection(page)
    await choose(page, 'info', /info@example\.org/)
    await expect(entry(page, SENDER_004.receiveOnlyAlias)).toBeVisible()
    await saveButton(page).click()
    await expect(page.locator('#section-mailbox [role="status"]').first()).toContainText(
      'Changes to mailbox anna@example.org have been saved',
    )
    const [request] = await saves(mockApi)
    expect(request!.headers['if-match']).toBeTruthy()
    const body = request!.body as { explicitPermissions: string[] }
    expect(Object.keys(body)).toEqual(['explicitPermissions'])
    expect([...body.explicitPermissions].sort()).toEqual(
      [
        SENDER_004.explicitDomain,
        SENDER_004.outsideScope,
        SENDER_004.stale,
        SENDER_004.receiveOnlyAlias,
      ].sort(),
    )
    await expect(page.locator('[data-value="senderAcl"]')).toContainText(
      SENDER_004.receiveOnlyAlias,
    )
  })

  test('US5-AS3 FR-051 "*" shows that the sender check is disabled and is saved alone', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('sender-settings')
    await openMailboxSection(page)
    await choose(page, '*', /domain \* /)
    await expect(page.locator('[data-sender-check-disabled]')).toHaveText(
      'Sender check is disabled',
    )
    await saveButton(page).click()
    await expect.poll(async () => (await saves(mockApi)).length).toBe(1)
    expect((await saves(mockApi))[0]!.body).toEqual({ explicitPermissions: ['*'] })
    await expect(page.locator('[data-value="senderAcl"]')).toContainText(
      'Disable sender check for domain * (+ alias domains)',
    )
  })

  test('US5-AS7 an external address in a local domain is refused, marked, and every entry stays', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('sender-settings')
    await openMailboxSection(page)
    const field = page.getByLabel('External sender addresses')
    await field.fill(`news@mailer.example, ${SENDER_004.localExternal}`)
    await saveButton(page).click()
    await expect(
      page.getByText(
        `${SENDER_004.localExternal}: External sender "example.net" uses an invalid domain`,
      ),
    ).toBeVisible()
    await expect(field).toHaveValue(`news@mailer.example, ${SENDER_004.localExternal}`)
    await expect(page.locator('[data-sender-acl]')).toBeVisible()
  })

  test('US5-AS10 FR-055 an entry the mailbox already has through an alias is named as not needed', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('sender-settings')
    await openMailboxSection(page)
    const search = page.getByRole('combobox', { name: 'Allow to send as', exact: true })
    await search.click()
    await search.fill('shared')
    const option = page
      .getByRole('listbox', { name: 'Allow to send as' })
      .getByRole('option')
      .filter({ hasText: SENDER_004.notNeededAlias })
    await expect(option).toBeVisible()
    await mockApi.patch({
      changeElsewhere: {
        alias: {
          [SENDER_004.notNeededAlias]: { destinations: [SENDER_004.mailbox], senderAllowed: true },
        },
      },
    })
    await option.click()
    await saveButton(page).click()
    await expect(page.locator('#section-mailbox [role="status"]').first()).toContainText(
      `${SENDER_004.notNeededAlias} was not added: an alias that delivers to this mailbox already allows sending as it.`,
    )
  })

  test('US5-AS4 FR-054 the domain administrator sends back the entries it cannot change, never the external addresses', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('sender-settings-da')
    await openMailboxSection(page)
    await entry(page, SENDER_004.explicitDomain)
      .getByRole('button', { name: /^Remove/ })
      .click()
    await saveButton(page).click()
    await expect.poll(async () => (await saves(mockApi)).length).toBe(1)
    const body = (await saves(mockApi))[0]!.body as { explicitPermissions: string[] }
    expect(body).not.toHaveProperty('externalSenderAddresses')
    expect(body.explicitPermissions).toContain(SENDER_004.outsideScope)
    expect(body.explicitPermissions).not.toContain(SENDER_004.explicitDomain)
  })

  test('FR-027 a change made elsewhere keeps the input and lists the changed set', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('sender-settings')
    await openMailboxSection(page)
    await entry(page, SENDER_004.explicitDomain)
      .getByRole('button', { name: /^Remove/ })
      .click()
    await mockApi.patch({
      changeElsewhere: {
        senderSettings: { [SENDER_004.mailbox]: { explicit: ['@shop.example'] } },
      },
    })
    await saveButton(page).click()
    const notice = page.locator('[data-outdated]')
    await expect(notice).toContainText('Allow to send as')
    await expect(notice).toContainText(
      'Disable sender check for domain shop.example (+ alias domains)',
    )
    await expect(entry(page, SENDER_004.explicitDomain)).toHaveCount(0)
  })

  test('FR-004 a refusal of the external addresses refreshes the permissions', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('sender-settings-da-extend')
    await openMailboxSection(page)
    await page.getByLabel('External sender addresses').fill('new@outside.example')
    await mockApi.patch({ flags: { reseller: { extendSenderAcl: false } } })
    const identityReads = async () =>
      (await mockApi.requests()).filter((r) => r.operationId === 'getIdentity').length
    const before = await identityReads()
    await saveButton(page).click()
    await expect.poll(identityReads).toBeGreaterThan(before)
    await expect(page.getByLabel('External sender addresses')).toHaveCount(0)
  })

  test('FR-025 unsaved entries ask before leaving the section', async ({ page, mockApi }) => {
    await mockApi.use('sender-settings')
    await page.goto(MAILBOX_PAGE)
    await page.locator('#section-mailbox').getByRole('button', { name: /^Edit/ }).click()
    await entry(page, SENDER_004.explicitDomain)
      .getByRole('button', { name: /^Remove/ })
      .click()
    await page.goBack()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toContainText('Leave without saving?')
    await dialog.getByRole('button', { name: 'Stay' }).click()
    await expect(entry(page, SENDER_004.explicitDomain)).toHaveCount(0)
  })

  test('Edge: a network failure during the save keeps the entries', async ({ page, mockApi }) => {
    await mockApi.use('sender-settings')
    await openMailboxSection(page)
    await entry(page, SENDER_004.explicitDomain)
      .getByRole('button', { name: /^Remove/ })
      .click()
    await page.route('**/sender-settings', (route) =>
      route.request().method() === 'PATCH' ? route.abort() : route.continue(),
    )
    await saveButton(page).click()
    await expect(
      page.getByText('The server could not be reached.', { exact: false }).first(),
    ).toBeVisible()
    await expect(entry(page, SENDER_004.explicitDomain)).toHaveCount(0)
    await expect(page.locator('[data-sender-acl]')).toBeVisible()
  })
})
