// UI 004 US2, creating aliases (T042), on the classic "Add alias" form: one and several
// addresses, the goto checkboxes, the options, every documented refusal at its field, the pending
// state, the leave guard, drafts across a session expiry and the network edge cases.
import { CREATE_HOLDERS_004 } from '../../mocks/scenarios/aliases-create'
import { submitPassword } from '../fixtures/flows'
import { expect, test } from '../fixtures/test'
import type { Page } from '@playwright/test'

const addresses = (page: Page) => page.getByLabel('Alias address/es')
const gotos = (page: Page) => page.getByLabel('Goto addresses')
const submit = (page: Page) => page.getByRole('button', { name: 'Add', exact: true })
const creations = async (mockApi: {
  requests(): Promise<{ operationId: string | null; body?: unknown }[]>
}) => (await mockApi.requests()).filter((request) => request.operationId === 'createAlias')

test.describe('alias creation', () => {
  test('US2-AS1 FR-018 FR-021 FR-067 one address opens the new alias, with the legacy defaults and help text', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
  }) => {
    await mockApi.use('aliases-create')
    await page.goto('aliases')
    await page.getByRole('link', { name: 'Add alias' }).first().click()
    await expect(page.getByRole('heading', { level: 1, name: 'Add alias' })).toBeVisible()
    await expect(page.getByText('mailcow domains only')).toBeVisible()
    await expect(page.getByLabel('Alias is visible in SOGo')).toBeChecked()
    await expect(page.getByLabel('Internal')).not.toBeChecked()
    await expect(page.getByLabel('Allow to send as this alias')).toBeChecked()
    await expect(page.getByLabel('Active')).toBeChecked()
    await expectAccessible()
    await expectNoHorizontalScroll()
    await addresses(page).fill('team@example.org')
    await gotos(page).fill('anna@example.org, bob@example.org')
    await submit(page).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Edit alias' })).toBeVisible()
    await expect(page.locator('[data-alert="success"]')).toHaveText(
      /Alias address team@example\.org \(\d+\) has been added/,
    )
    const [request] = await creations(mockApi)
    expect(request!.body).toEqual({
      address: 'team@example.org',
      destinations: ['anna@example.org', 'bob@example.org'],
      active: true,
      senderAllowed: true,
      internal: false,
      groupwareVisible: true,
    })
    await page.goto('aliases?q=team@example.org')
    await expect(page.locator('[data-entry]')).toHaveCount(1)
  })

  test('US2-AS2 FR-065 a catch-all entry is marked before saving and the fields turn off correction', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('aliases-create')
    await page.goto('aliases/new')
    for (const field of [addresses(page), gotos(page)]) {
      await expect(field).toHaveAttribute('autocapitalize', 'none')
      await expect(field).toHaveAttribute('autocorrect', 'off')
      await expect(field).toHaveAttribute('spellcheck', 'false')
    }
    await addresses(page).fill('@example.com')
    await expect(page.locator('[data-entry-marker]')).toContainText('Catch-All')
    await gotos(page).fill('erik@example.com')
    await submit(page).click()
    await expect(page.locator('[data-badge="catchAll"]')).toHaveText('Catch-All')
  })

  test('US2-AS3 a goto checkbox disables the addresses, which are then not sent', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('aliases-create')
    await page.goto('aliases/new')
    await gotos(page).fill('anna@example.org')
    await page.getByLabel('Silently discard mail').check()
    await expect(gotos(page)).toBeDisabled()
    await page.getByLabel('Learn as spam').check()
    await expect(page.getByLabel('Silently discard mail')).not.toBeChecked()
    await page.getByLabel('Learn as spam').uncheck()
    await expect(gotos(page)).toBeEnabled()
    await expect(gotos(page)).toHaveValue('anna@example.org')
    await page.getByLabel('Silently discard mail').check()
    await addresses(page).fill('void@example.org')
    await submit(page).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Edit alias' })).toBeVisible()
    const [request] = await creations(mockApi)
    expect(request!.body).toMatchObject({ address: 'void@example.org', destinationType: 'discard' })
    expect(request!.body).not.toHaveProperty('destinations')
  })

  test('US2-AS4 FR-023 an address in use names its holder at the address field and keeps the input', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('aliases-create')
    await page.goto('aliases/new')
    await gotos(page).fill('bob@example.org')
    const cases: [string, string][] = [
      [
        CREATE_HOLDERS_004.alias,
        `${CREATE_HOLDERS_004.alias} is already known as an alias address`,
      ],
      [
        CREATE_HOLDERS_004.temporaryAlias,
        `${CREATE_HOLDERS_004.temporaryAlias} is already known as a temporary alias address (spam alias address)`,
      ],
      [
        CREATE_HOLDERS_004.mailbox,
        `${CREATE_HOLDERS_004.mailbox} is already known as an alias, a mailbox or an alias address expanded from an alias domain.`,
      ],
      [
        CREATE_HOLDERS_004.throughAliasDomain,
        `${CREATE_HOLDERS_004.throughAliasDomain} is already known as an alias, a mailbox or an alias address expanded from an alias domain.`,
      ],
    ]
    for (const [address, message] of cases) {
      await addresses(page).fill(address)
      await submit(page).click()
      await expect(page.getByText(message, { exact: true }).first()).toBeVisible()
      await expect(addresses(page)).toHaveValue(address)
      await expect(gotos(page)).toHaveValue('bob@example.org')
    }
    await expectAccessible()
  })

  test('US2-AS5 a domain at its alias limit is refused with the legacy message', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('aliases-create-limit')
    await page.goto('aliases/new')
    await addresses(page).fill('more@example.org')
    await gotos(page).fill('bob@example.org')
    await submit(page).click()
    await expect(page.getByText('Max. aliases exceeded').first()).toBeVisible()
  })

  test('US2-AS6 FR-019 an invalid destination is named at its entry and nothing is created', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('aliases-create')
    await page.goto('aliases/new')
    await submit(page).click()
    await expect(page.getByText('Alias address must not be empty').first()).toBeVisible()
    await expect(
      page.getByText('An alias address must contain at least one valid goto address').first(),
    ).toBeVisible()
    expect(await creations(mockApi)).toHaveLength(0)
    await addresses(page).fill('team@example.org')
    await gotos(page).fill('anna@example.org, not-valid, bob@example.org')
    await submit(page).click()
    await expect(page.getByText('Goto address not-valid is invalid').first()).toBeVisible()
    await expect(page.getByRole('heading', { level: 1, name: 'Add alias' })).toBeVisible()
  })

  test('US2-AS7 FR-020 FR-004 the external destination notice, the refusal and the identity refresh', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('aliases-create-da-no-external')
    await page.goto('aliases/new')
    await expect(page.locator('[data-external-notice]')).toBeVisible()
    await addresses(page).fill('ext@example.org')
    await gotos(page).fill('someone@outside.example')
    const identityReads = async () =>
      (await mockApi.requests()).filter((request) => request.operationId === 'getIdentity').length
    const before = await identityReads()
    await submit(page).click()
    await expect(
      page.getByText('External goto address someone@outside.example is not allowed').first(),
    ).toBeVisible()
    await expect.poll(identityReads).toBeGreaterThan(before)

    await mockApi.use('external-destinations-disabled')
    await page.goto('aliases/new')
    await expect(page.locator('[data-external-notice]')).toBeVisible()
    await mockApi.use('aliases-create')
    await page.goto('aliases/new')
    await expect(page.locator('[data-external-notice]')).toHaveCount(0)
  })

  test('US2-AS8 FR-021 several addresses: one request each in order, results, and only the refused one stays', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('aliases-create')
    await page.goto('aliases/new')
    await addresses(page).fill('info2@example.org, sales@example.org\noffice@example.org')
    await gotos(page).fill('anna@example.org')
    await submit(page).click()
    const results = page.locator('[data-create-results]')
    await expect(results).toBeVisible()
    await expect(results).toContainText(/Alias address info2@example\.org \(\d+\) has been added/)
    await expect(results).toContainText('sales@example.org is already known as an alias address')
    await expect(results).toContainText(/Alias address office@example\.org \(\d+\) has been added/)
    await expect(results.getByRole('link')).toHaveCount(2)
    await expect(addresses(page)).toHaveValue('sales@example.org')
    expect(
      (await creations(mockApi)).map((request) => (request.body as { address: string }).address),
    ).toEqual(['info2@example.org', 'sales@example.org', 'office@example.org'])
    await expectAccessible()
  })

  test('US2-AS10 FR-025 leaving with unsaved input asks first', async ({ page, mockApi }) => {
    await mockApi.use('aliases-create')
    await page.goto('aliases')
    await page.getByRole('link', { name: 'Add alias' }).first().click()
    await addresses(page).fill('draft@example.org')
    await page.goBack()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toContainText('Leave without saving?')
    await dialog.getByRole('button', { name: 'Stay' }).click()
    await expect(page).toHaveURL(/aliases\/new/)
    await expect(addresses(page)).toHaveValue('draft@example.org')
  })

  test('US2-AS11 without the groupware there is no SOGo option and it is not sent', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('groupware-disabled')
    await page.goto('aliases/new')
    await expect(page.getByLabel('Alias is visible in SOGo')).toHaveCount(0)
    await addresses(page).fill('nogroup@example.org')
    await gotos(page).fill('bob@example.org')
    await submit(page).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Edit alias' })).toBeVisible()
    const [request] = await creations(mockApi)
    expect(request!.body).not.toHaveProperty('groupwareVisible')
  })

  test('FR-024 Edge: double submission, the submit is disabled and the pending state announced', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('aliases-create')
    await mockApi.delay('createAlias', 1500)
    await page.goto('aliases/new')
    await addresses(page).fill('slow@example.org')
    await gotos(page).fill('bob@example.org')
    await submit(page).click()
    await expect(submit(page)).toBeDisabled()
    await expect(page.locator('[data-live="polite"]')).toHaveText('Saving…')
    await expect(page.getByRole('heading', { level: 1, name: 'Edit alias' })).toBeVisible()
    expect(await creations(mockApi)).toHaveLength(1)
  })

  test('Edge: network failures keep the input; in a multi-address run the rest is not processed', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('aliases-create-network')
    let calls = 0
    await page.route('**/api/v2/aliases', (route) => {
      if (route.request().method() !== 'POST') return route.continue()
      calls += 1
      return calls === 2 ? route.abort() : route.continue()
    })
    await page.goto('aliases/new')
    await addresses(page).fill('one@example.org two@example.org three@example.org')
    await gotos(page).fill('bob@example.org')
    await submit(page).click()
    const results = page.locator('[data-create-results]')
    await expect(results).toContainText(/Alias address one@example\.org \(\d+\) has been added/)
    await expect(results).toContainText('Not processed')
    await expect(
      page.getByText('The server could not be reached.', { exact: false }).first(),
    ).toBeVisible()
    await expect(addresses(page)).toHaveValue('two@example.org, three@example.org')
    await submit(page).click()
    await expect(page.locator('[data-create-results]')).toContainText(/three@example\.org \(\d+\)/)
  })

  test('Edge: an unknown problem type shows the generic message with the request ID', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('aliases-create')
    await mockApi.failNext('createAlias', { status: 409, type: 'brand-new-problem' })
    await page.goto('aliases/new')
    await addresses(page).fill('new@example.org')
    await gotos(page).fill('bob@example.org')
    await submit(page).click()
    await expect(page.getByText(/Request ID/)).toBeVisible()
  })

  test('Edge: the input survives a session expiry and a new sign-in in the same tab', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('aliases-create')
    await page.goto('aliases/new')
    await addresses(page).fill('kept@example.org')
    await gotos(page).fill('bob@example.org')
    await mockApi.patch({ expireSession: true })
    await submit(page).click()
    await expect(page.getByLabel('Username', { exact: true })).toBeVisible()
    await submitPassword(page, 'admin')
    await expect(page.getByRole('heading', { level: 1, name: 'Add alias' })).toBeVisible()
    await expect(addresses(page)).toHaveValue('kept@example.org')
    await expect(gotos(page)).toHaveValue('bob@example.org')
  })

  test('Edge: capabilities cannot be read, the form shows the error with a retry', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('capabilities-unavailable')
    await page.goto('aliases/new')
    await expect(
      page.getByText('The server settings this form needs could not be loaded.'),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
    await expect(addresses(page)).toHaveCount(0)
    await expectAccessible()
  })
})
