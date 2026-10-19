// UI 004 US7, changing and deleting resources (T093): the "Resource" form as one section with the
// note that the address stays; only changed members, the booking limit only for a hard limit;
// deactivation without a confirmation (legacy has none); the outdated flow; deletion from the list
// with the groupware data named; an outdated deletion; a vanished resource.
import { RESOURCES_004 } from '../../mocks/scenarios/resources'
import { expect, test } from '../fixtures/test'
import { listReady } from '../aliases/helpers'
import { entry, requestsOf, saveButton, section, trigger } from './helpers'

test.describe('resources: changes and deletion', () => {
  test('US7-AS6 FR-046 a new description keeps the address, and only changed members are sent', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('resources')
    await page.goto(`resources/${RESOURCES_004.meetingRoom}?edit=resource`)
    await expect(section(page)).toContainText('The address does not change')
    await expectAccessible()
    await section(page).getByRole('textbox', { name: 'Description' }).fill('Big Room')
    await section(page).getByRole('combobox', { name: 'Multiple bookings' }).selectOption('limited')
    await section(page).getByRole('spinbutton').fill('4')
    await saveButton(page).click()
    await expect(section(page).locator('[role="status"]').first()).toHaveText(
      `Changes to mailbox ${RESOURCES_004.meetingRoom} have been saved`,
    )
    const [request] = await requestsOf(mockApi, 'updateResource')
    expect(request!.body).toEqual({
      description: 'Big Room',
      bookingRule: 'limited',
      bookingLimit: 4,
    })
    expect(request!.headers['if-match']).toBeTruthy()
    await expect(page.locator('[data-field="address"]')).toHaveText(RESOURCES_004.meetingRoom)
  })

  test('deactivating is saved without a confirmation', async ({ page, mockApi }) => {
    await mockApi.use('resources')
    await page.goto(`resources/${RESOURCES_004.meetingRoom}?edit=resource`)
    await section(page).getByRole('checkbox', { name: 'Active' }).click()
    await saveButton(page).click()
    await expect(section(page).locator('[role="status"]').first()).toBeVisible()
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    expect((await requestsOf(mockApi, 'updateResource'))[0]!.body).toEqual({ active: false })
  })

  test('FR-027 a change made elsewhere is marked, and "Save again" sends the new version', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('resources')
    await page.goto(`resources/${RESOURCES_004.meetingRoom}?edit=resource`)
    await section(page).getByRole('checkbox', { name: 'Active' }).click()
    await mockApi.patch({
      changeElsewhere: { resource: { [RESOURCES_004.meetingRoom]: { kind: 'thing' } } },
    })
    await saveButton(page).click()
    await expect(section(page).locator('[data-outdated]')).toContainText('Kind: now saved as Thing')
    await section(page).getByRole('button', { name: 'Save again' }).click()
    await expect(section(page).locator('[role="status"]').first()).toBeVisible()
    const [first, second] = await requestsOf(mockApi, 'updateResource')
    expect(second!.headers['if-match']).not.toBe(first!.headers['if-match'])
  })

  test('US7-AS7 the deletion names the groupware data, and an outdated deletion confirms again', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('resources')
    await page.goto('resources')
    await listReady(page)
    await trigger(page, RESOURCES_004.meetingRoom).click()
    await page.getByRole('menuitem', { name: 'Remove' }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toContainText(RESOURCES_004.meetingRoom)
    await expect(dialog).toContainText('calendar')
    await mockApi.patch({
      changeElsewhere: { resource: { [RESOURCES_004.meetingRoom]: { description: 'Renamed' } } },
    })
    await dialog.getByRole('button', { name: 'Delete now' }).click()
    await expect(dialog).toContainText('The resource changed in the meantime')
    await dialog.getByRole('button', { name: 'Delete now' }).click()
    await expect(page.locator('[data-alert="success"]')).toHaveText(
      `Resource ${RESOURCES_004.meetingRoom} has been removed`,
    )
    await expect(entry(page, RESOURCES_004.meetingRoom)).toHaveCount(0)
  })

  test('FR-028 a resource deleted elsewhere sends the page back to the list', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('resources')
    await page.goto(`resources/${RESOURCES_004.meetingRoom}?edit=resource`)
    await section(page).getByRole('checkbox', { name: 'Active' }).click()
    await mockApi.patch({ deleteElsewhere: { resource: [RESOURCES_004.meetingRoom] } })
    await saveButton(page).click()
    await expect(page).toHaveURL(/\/ng\/resources$/)
    await expect(page.locator('[data-alert="danger"]')).toHaveText(
      'This resource no longer exists or is no longer available to you.',
    )
  })
})
