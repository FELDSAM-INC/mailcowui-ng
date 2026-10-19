// UI 004 US7, "Add resource" (T092), the classic `#addResourceModal` in its order: description with
// the address preview (legacy derives it silently), domain (domains only), kind, multiple bookings
// (legacy's select, the number field for a hard limit), active, "Add". Refusals at their fields.
import { expect, test } from '../fixtures/test'
import type { Page } from '@playwright/test'
import { requestsOf } from './helpers'

const description = (page: Page) => page.getByRole('textbox', { name: 'Description' })
const add = (page: Page) => page.getByRole('button', { name: 'Add', exact: true })
const preview = (page: Page) => page.locator('[data-address-preview]')

async function chooseDomain(page: Page, name: string) {
  const field = page.getByRole('combobox', { name: 'Domain', exact: true })
  await field.click()
  await field.fill(name)
  await page
    .getByRole('option', { name: new RegExp(`^${name.replace(/\./g, '\\.')}`) })
    .first()
    .click()
}

async function fill(page: Page, text: string, domain = 'example.org') {
  await description(page).fill(text)
  await chooseDomain(page, domain)
  await page.getByRole('combobox', { name: 'Kind' }).selectOption('location')
}

test.describe('resources: creation', () => {
  test("US7-AS1 FR-045 the previewed address, then the server's address after saving", async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('resources')
    await page.goto('resources/new')
    await expect(page.getByRole('heading', { level: 1, name: 'Add resource' })).toBeVisible()
    await fill(page, 'Meeting Room 7')
    await expect(preview(page)).toContainText('MeetingRoom7@example.org')
    await expect(page.getByRole('combobox', { name: 'Multiple bookings' })).toHaveValue('unlimited')
    await expectAccessible()
    await add(page).click()
    await expect(page).toHaveURL(/\/resources\/MeetingRoom7@example\.org$/)
    await expect(page.locator('[data-alert="success"]')).toHaveText(
      'Resource MeetingRoom7@example.org has been added',
    )
    const [request] = await requestsOf(mockApi, 'createResource')
    expect(request!.body).toEqual({
      description: 'Meeting Room 7',
      domain: 'example.org',
      kind: 'location',
      bookingRule: 'unlimited',
      active: true,
    })
  })

  test('US7-AS2 an address in use is shown at the description', async ({ page, mockApi }) => {
    await mockApi.use('resources')
    await page.goto('resources/new')
    await fill(page, 'Meeting Room 1')
    await add(page).click()
    await expect(page.locator('#resource-description-error')).toContainText(
      'MeetingRoom1@example.org is already known as an alias, a mailbox or an alias address expanded from an alias domain.',
    )
  })

  test('US7-AS3 "!!!" gives no address and cannot be added', async ({ page, mockApi }) => {
    await mockApi.use('resources')
    await page.goto('resources/new')
    await fill(page, '!!!')
    await expect(preview(page)).toContainText('No address can be derived')
    await expect(add(page)).toBeDisabled()
  })

  test("US7-AS4 the hard limit takes whole numbers within the server's range", async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('resources-limits')
    await page.goto('resources/new')
    await fill(page, 'Bus')
    await page.getByRole('combobox', { name: 'Multiple bookings' }).selectOption('limited')
    const limit = page.getByRole('spinbutton')
    await limit.fill('0')
    await add(page).click()
    await expect(page.locator('#resource-bookingLimit-error')).toContainText(
      'Enter a value from 1 to 10.',
    )
    await limit.fill('3')
    await add(page).click()
    await expect(page).toHaveURL(/\/resources\/Bus@example\.org$/)
    const [request] = (await requestsOf(mockApi, 'createResource')).slice(-1)
    expect(request!.body).toMatchObject({ bookingRule: 'limited', bookingLimit: 3 })
  })

  test("FR-044 the description is checked against the server's limit", async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('resources-limits')
    await page.goto('resources/new')
    await fill(page, 'x'.repeat(41))
    await add(page).click()
    await expect(page.locator('#resource-description-error')).toBeVisible()
    expect(await requestsOf(mockApi, 'createResource')).toHaveLength(0)
  })

  test('Edge: letters outside A–Z are left out of the address', async ({ page, mockApi }) => {
    await mockApi.use('resources')
    await page.goto('resources/new')
    await fill(page, 'Raum Süd')
    await expect(preview(page)).toContainText('RaumSd@example.org')
  })

  test('Edge: the form waits for the capabilities and says when they cannot be read', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('capabilities-unavailable')
    await page.goto('resources/new')
    await expect(
      page.getByText('The server settings this form needs could not be loaded.'),
    ).toBeVisible()
    await expect(description(page)).toHaveCount(0)
  })

  test('FR-025 leaving the form with input asks first', async ({ page, mockApi }) => {
    await mockApi.use('resources')
    await page.goto('resources')
    await page.getByRole('link', { name: 'Add resource' }).click()
    await description(page).fill('Draft room')
    await page.goBack()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Stay' }).click()
    await expect(description(page)).toHaveValue('Draft room')
  })
})
