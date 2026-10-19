// UI 004 US3, editing an alias on its page (T051): the classic "Edit alias" form as one section
// (`templates/edit/alias.twig`, legacy form map), only the changed members with the version read,
// "changed elsewhere", special actions, deactivation without a confirmation (legacy has none),
// a vanished alias, an orphaned alias, the leave guard, the full-screen section at 360 px, stored
// values the form does not touch, the groupware switch, a lost domain and a network failure.
import { DOMAIN_ADMIN_004, MAILBOX_004, RESOURCE_004 } from '../../mocks/scenarios/feature-004-base'
import { EDIT_ALIAS_004 } from '../../mocks/scenarios/aliases-edit'
import { expect, test } from '../fixtures/test'
import type { Page, Response } from '@playwright/test'

type Requests = {
  requests(): Promise<
    { operationId: string | null; body?: unknown; headers: Record<string, string> }[]
  >
}
const updates = async (mockApi: Requests) =>
  (await mockApi.requests()).filter((r) => r.operationId === 'updateAlias')

const section = (page: Page) => page.locator('#section-alias')
const saveButton = (page: Page) => section(page).getByRole('button', { name: 'Save changes' })
const addressField = (page: Page) =>
  section(page).getByRole('textbox', { name: 'Edit alias', exact: true })
const gotoField = (page: Page) =>
  section(page).getByRole('textbox', { name: /^Goto address\/es/ })
const status = (page: Page) => section(page).locator('[role="status"]').first()

/** Opens the alias page with its section open, and returns the alias as read. */
async function openEdit(page: Page, id: number): Promise<{ etag: string }> {
  const read = page.waitForResponse(
    (response: Response) =>
      response.request().method() === 'GET' && response.url().endsWith(`/api/v2/aliases/${id}`),
  )
  await page.goto(`aliases/${id}?edit=alias`)
  const response = await read
  await expect(addressField(page)).toBeVisible()
  return ((await response.json()) as { data: { etag: string } }).data
}

test.describe('alias page: editing', () => {
  test('US3-AS1 FR-022 FR-026 a new destination is saved alone, with the version read', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('aliases-edit')
    await page.goto(`aliases/${EDIT_ALIAS_004.sales}`)
    const read = page.waitForResponse(
      (response) =>
        response.request().method() === 'GET' &&
        response.url().endsWith(`/api/v2/aliases/${EDIT_ALIAS_004.sales}`),
    )
    await page.reload()
    const { data } = (await (await read).json()) as { data: { etag: string } }
    await section(page).getByRole('button', { name: 'Edit Edit alias' }).click()
    await expect(page).toHaveURL(/\?edit=alias$/)
    await expect(addressField(page)).toHaveValue('sales@example.org')
    await expect(gotoField(page)).toHaveValue(MAILBOX_004.anna)
    await expectAccessible()

    await gotoField(page).fill(MAILBOX_004.bob)
    await saveButton(page).click()
    await expect(status(page)).toHaveText('Changes to alias address sales@example.org have been saved')
    const [request] = await updates(mockApi)
    expect(request!.headers['if-match']).toBe(data.etag)
    expect(request!.body).toEqual({ destinationType: 'addresses', destinations: [MAILBOX_004.bob] })
    await expect(page).not.toHaveURL(/edit=/)
    await expect(section(page).locator('[data-field="destinations"]')).toHaveText(MAILBOX_004.bob)
  })

  test('US3-AS2 SC-006 FR-027 "changed elsewhere" keeps the input, marks the value and saves again with the new version', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('aliases-edit')
    const read = await openEdit(page, EDIT_ALIAS_004.sales)
    await section(page).getByRole('textbox', { name: 'Public comment' }).fill('Sales team')
    await mockApi.patch({ changeElsewhere: { alias: { [EDIT_ALIAS_004.sales]: { active: false } } } })
    await saveButton(page).click()
    const notice = section(page).locator('[data-outdated]')
    await expect(notice).toContainText('Changed elsewhere')
    await expect(notice).toContainText('Active: now saved as No')
    await expect(section(page).getByRole('textbox', { name: 'Public comment' })).toHaveValue(
      'Sales team',
    )
    expect(await updates(mockApi)).toHaveLength(1)

    await section(page).getByRole('button', { name: 'Save again' }).click()
    await expect(status(page)).toHaveText('Changes to alias address sales@example.org have been saved')
    const [first, second] = await updates(mockApi)
    expect(first!.headers['if-match']).toBe(read.etag)
    expect(second!.headers['if-match']).not.toBe(read.etag)
    expect(second!.body).toEqual({ publicComment: 'Sales team' })
    await expect(section(page).locator('[data-field="publicComment"]')).toHaveText('Sales team')
  })

  test('FR-027 "Discard my changes" takes the reloaded values and sends nothing', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('aliases-edit')
    await openEdit(page, EDIT_ALIAS_004.sales)
    await section(page).getByRole('textbox', { name: 'Public comment' }).fill('Sales team')
    await mockApi.patch({
      changeElsewhere: { alias: { [EDIT_ALIAS_004.sales]: { publicComment: 'Changed' } } },
    })
    await saveButton(page).click()
    await expect(section(page).locator('[data-outdated]')).toContainText(
      'Public comment: now saved as Changed',
    )
    await section(page).getByRole('button', { name: 'Discard my changes' }).click()
    await expect(section(page).getByRole('textbox', { name: 'Public comment' })).toHaveValue(
      'Changed',
    )
    await expect(section(page).locator('[data-outdated]')).toHaveCount(0)
    expect(await updates(mockApi)).toHaveLength(1)
  })

  test('US3-AS3 deactivating is saved at once with only "active", without a confirmation', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('aliases-edit-da')
    await openEdit(page, EDIT_ALIAS_004.partners)
    await section(page).getByRole('checkbox', { name: 'Active', exact: true }).click()
    await saveButton(page).click()
    await expect(status(page)).toHaveText(
      'Changes to alias address partners@example.org have been saved',
    )
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    const [request] = await updates(mockApi)
    expect(request!.body).toEqual({ active: false })
  })

  test('US3-AS4 a special action is sent without destinations, and the goto field keeps its text', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('aliases-edit')
    await openEdit(page, EDIT_ALIAS_004.sales)
    await section(page).getByRole('checkbox', { name: 'Silently discard mail' }).click()
    await expect(gotoField(page)).toBeDisabled()
    await expect(gotoField(page)).toHaveValue(MAILBOX_004.anna)
    await saveButton(page).click()
    await expect(status(page)).toBeVisible()
    const [request] = await updates(mockApi)
    expect(request!.body).toEqual({ destinationType: 'discard' })
    await expect(section(page).locator('[data-field="destinations"]')).toHaveText(
      'Silently discard mail',
    )
  })

  test('US3-AS6 FR-028 an alias deleted elsewhere is reported and the list opens', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('aliases-edit')
    await openEdit(page, EDIT_ALIAS_004.sales)
    await section(page).getByRole('textbox', { name: 'Private comment' }).fill('gone soon')
    await mockApi.patch({ deleteElsewhere: { alias: [EDIT_ALIAS_004.sales] } })
    await saveButton(page).click()
    await expect(page).toHaveURL(/\/ng\/aliases$/)
    await expect(page.locator('[data-alert="danger"]')).toHaveText(
      'This alias no longer exists or is no longer available to you.',
    )
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
  })

  test('US3-AS7 an orphaned alias is saved only with an address in an existing domain', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('aliases-edit')
    await openEdit(page, EDIT_ALIAS_004.orphaned)
    await section(page).getByRole('checkbox', { name: 'Internal', exact: true }).click()
    await saveButton(page).click()
    await expect(section(page).locator('#alias-edit-address-error')).toContainText(
      'Domain gone.example not found',
    )
    await addressField(page).fill('lost@example.org')
    await saveButton(page).click()
    await expect(status(page)).toHaveText('Changes to alias address lost@example.org have been saved')
    const last = (await updates(mockApi)).at(-1)!
    expect(last.body).toEqual({ address: 'lost@example.org', internal: true })
    await expect(page.locator('[data-orphaned-warning]')).toHaveCount(0)
  })

  test('FR-025 leaving the open section with changes asks first', async ({ page, mockApi }) => {
    await mockApi.use('aliases-edit')
    await openEdit(page, EDIT_ALIAS_004.sales)
    await section(page).getByRole('textbox', { name: 'Private comment' }).fill('draft')
    await section(page).getByRole('button', { name: 'Cancel' }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Stay' }).click()
    await expect(section(page).getByRole('textbox', { name: 'Private comment' })).toHaveValue(
      'draft',
    )
    await page.goto('aliases')
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
  })

  test('FR-064 at 360 px the section opens full screen through ?edit= and Back closes it', async ({
    page,
    mockApi,
    expectNoHorizontalScroll,
  }) => {
    await page.setViewportSize({ width: 360, height: 740 })
    await mockApi.use('aliases-edit')
    await page.goto(`aliases/${EDIT_ALIAS_004.sales}`)
    await section(page).getByRole('button', { name: 'Edit Edit alias' }).click()
    await expect(section(page)).toHaveAttribute('data-layout', 'full')
    await expect(page.locator('[data-alias-summary]')).toHaveCount(0)
    await expectNoHorizontalScroll()
    await page.goBack()
    await expect(page).not.toHaveURL(/edit=/)
    await expect(section(page)).toHaveAttribute('data-layout', 'inline')
    await expect(page.locator('[data-alias-summary]')).toBeVisible()
  })

  test('Edge: a stored comment longer than the limit does not stop other changes', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('aliases-edit')
    await openEdit(page, EDIT_ALIAS_004.notes)
    await section(page).getByRole('checkbox', { name: 'Internal', exact: true }).click()
    await saveButton(page).click()
    await expect(status(page)).toHaveText('Changes to alias address notes@example.org have been saved')
    expect((await updates(mockApi))[0]!.body).toEqual({ internal: true })
  })

  test('Edge: destinations stored by another tool are sent only once edited, then marked', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('aliases-edit')
    await openEdit(page, EDIT_ALIAS_004.rooms)
    await section(page).getByRole('checkbox', { name: 'Allow to send as this alias' }).click()
    await saveButton(page).click()
    await expect(status(page)).toBeVisible()
    expect((await updates(mockApi))[0]!.body).toEqual({ senderAllowed: false })

    await page.goto(`aliases/${EDIT_ALIAS_004.rooms}?edit=alias`)
    await gotoField(page).fill(`${RESOURCE_004.meetingRoom}, ${MAILBOX_004.anna}`)
    await saveButton(page).click()
    const message = `Goto address ${RESOURCE_004.meetingRoom} is invalid`
    await expect(section(page).getByText(message)).toHaveCount(1)
    await expect(gotoField(page)).toHaveValue(`${RESOURCE_004.meetingRoom}, ${MAILBOX_004.anna}`)
  })

  test('Edge: with the groupware disabled the SOGo option is neither shown nor sent', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('aliases-edit')
    await mockApi.patch({ capabilities004: { groupwareEnabled: false } })
    await openEdit(page, EDIT_ALIAS_004.sales)
    await expect(section(page).getByText('Alias is visible in SOGo')).toHaveCount(0)
    await section(page).getByRole('checkbox', { name: 'Internal', exact: true }).click()
    await saveButton(page).click()
    await expect(status(page)).toBeVisible()
    expect((await updates(mockApi))[0]!.body).toEqual({ internal: true })
  })

  test('Edge: a domain administrator who lost the domain gets a 404 on save and the list', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('aliases-edit-da')
    await openEdit(page, EDIT_ALIAS_004.sales)
    await section(page).getByRole('textbox', { name: 'Public comment' }).fill('x')
    await mockApi.patch({ domainAssignments: { [DOMAIN_ADMIN_004]: ['example.com'] } })
    await saveButton(page).click()
    await expect(page).toHaveURL(/\/ng\/aliases$/)
    await expect(page.locator('[data-alert="danger"]')).toHaveText(
      'This alias no longer exists or is no longer available to you.',
    )
  })

  test('Edge: a network failure during the save keeps the input and offers a retry', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('aliases-edit')
    await openEdit(page, EDIT_ALIAS_004.sales)
    await section(page).getByRole('textbox', { name: 'Public comment' }).fill('offline')
    await page.route('**/api/v2/aliases/*', (route) =>
      route.request().method() === 'PATCH' ? route.abort() : route.fallback(),
    )
    await saveButton(page).click()
    await expect(section(page).getByText('The server could not be reached.', { exact: false })).toBeVisible()
    await expect(section(page).getByRole('textbox', { name: 'Public comment' })).toHaveValue(
      'offline',
    )
    await page.unroute('**/api/v2/aliases/*')
    await section(page).getByRole('button', { name: /try again/i }).click()
    await expect(status(page)).toHaveText('Changes to alias address sales@example.org have been saved')
  })
})
