import { openAccountSections } from '../fixtures/flows'
import { mockPushSettings } from '../../mocks/factories/push-settings'
import { expect, test } from '../fixtures/test'

const mailbox = 'anna@example.org'

test('stored credentials stay blank, custom sounds remain available and comma-separated senders save without secrets', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('pushover-configured', {
    selfService: {
      mailboxes: { [mailbox]: { push: mockPushSettings({ sound: 'custom_sound' }) } },
    },
  })
  await page.goto('account/push-notifications')
  const form = page.locator('[data-push-form]')
  await expect(form.locator('input[name="token"]')).toHaveValue('')
  await expect(form.locator('input[name="userKey"]')).toHaveValue('')
  await expect(form).toContainText('A value is stored. Leave empty to keep it.')
  await expect(form).toContainText(mailbox)
  await expect(form.locator('select[name="sound"]')).toHaveValue('custom_sound')
  await expect(form.locator('select[name="sound"] option')).toContainText([
    'Pushover (default)',
    'Bike',
  ])
  await expect(form.locator('input[name="title"]')).toHaveAttribute('placeholder', 'Mail')
  await expect(form.locator('input[name="text"]')).toHaveAttribute(
    'placeholder',
    "You've got mail 📧",
  )
  await form.getByText('Advanced settings', { exact: true }).click()
  await expect(form.locator('input[name="senderPattern"]')).toBeVisible()
  // Opening the lower disclosure scrolls earlier fields behind the sticky header. Check the
  // credential field and its toggle when reached by keyboard, then scan the expanded form from
  // the top so an unrelated control is not measured at that incidental clipping boundary.
  const userKey = form.locator('input[name="userKey"]')
  for (let step = 0; step < 12; step++) {
    if (await userKey.evaluate((element) => element === document.activeElement)) break
    await page.keyboard.press('Shift+Tab')
  }
  for (const control of [userKey, form.locator('button[aria-controls$="-userKey"]')]) {
    await expect(control).toBeFocused()
    await expect
      .poll(() =>
        control.evaluate((element) => {
          const box = element.getBoundingClientRect()
          const header = document.querySelector('header')!.getBoundingClientRect()
          return box.top >= header.bottom && box.bottom <= innerHeight
        }),
      )
      .toBe(true)
    const box = (await control.boundingBox())!
    expect(box.width).toBeGreaterThanOrEqual(44)
    expect(box.height).toBeGreaterThanOrEqual(44)
    await page.keyboard.press('Tab')
  }
  await page.evaluate(() => window.scrollTo(0, 0))
  await expectAccessible()
  await expectNoHorizontalScroll()
  await form.locator('input[name="senders"]').fill('one@example.org, two@example.org')
  await form.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(form.getByRole('status')).toContainText('Pushover')
  const sent = (await mockApi.requests()).find(
    (request) => request.operationId === 'replacePushNotificationSettings',
  )!.body
  expect(sent).toMatchObject({
    senders: ['one@example.org', 'two@example.org'],
    sound: 'custom_sound',
  })
  expect(sent).not.toHaveProperty('token')
  expect(sent).not.toHaveProperty('userKey')
})

test('new settings require both credentials, a 29-character token is refused and valid credentials clear after save', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('pushover-unconfigured')
  await page.goto('account/push-notifications')
  const form = page.locator('[data-push-form]')
  await form.getByRole('button', { name: 'Verify credentials' }).click()
  await expect(form.getByRole('alert')).toContainText('Pushover token and or key missing')
  await form.locator('input[name="token"]').fill('a'.repeat(29))
  await form.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(form).toContainText('Pushover token has a wrong format')
  await expect(form).toContainText('Pushover token and or key missing')
  expect(await mockApi.countRequests('replacePushNotificationSettings')).toBe(0)
  await expectAccessible()
  await form.locator('input[name="token"]').fill('a'.repeat(30))
  await form.locator('input[name="userKey"]').fill('b'.repeat(30))
  await form.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(form.getByRole('status')).toContainText('Pushover')
  await expect(form.locator('input[name="token"]')).toHaveValue('')
  await expect(form.locator('input[name="userKey"]')).toHaveValue('')
  await expect(form.getByRole('button', { name: 'Remove', exact: true })).toBeVisible()
})

test('verification announces acceptance and the negative reason; confirmed removal restores empty settings', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('pushover-configured')
  await page.goto('account/push-notifications')
  const form = page.locator('[data-push-form]')
  await form.getByRole('button', { name: 'Verify credentials' }).click()
  await expect(form.getByRole('status')).toHaveText('Pushover API OK')
  await mockApi.patch({
    selfService: { pushVerification: { accepted: false, reason: 'Unknown user' } },
  })
  await form.getByRole('button', { name: 'Verify credentials' }).click()
  await expect(form.getByRole('status')).toHaveText('Pushover API ERR: Unknown user')
  await form.getByRole('button', { name: 'Remove', exact: true }).click()
  await expectAccessible()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Remove', exact: true }).click()
  await expect(form.getByRole('button', { name: 'Remove', exact: true })).toHaveCount(0)
  await expect(form).not.toContainText('A value is stored.')
  await expect(form.locator('input[name="title"]')).toHaveValue('')
  expect(await mockApi.countRequests('deletePushNotificationSettings')).toBe(1)
})

test('a Pushover outage names the service and the explicit retry succeeds', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('pushover-outage')
  await page.goto('account/push-notifications')
  const form = page.locator('[data-push-form]')
  await form.getByRole('button', { name: 'Verify credentials' }).click()
  await expect(form.getByRole('alert')).toContainText('Pushover')
  await mockApi.patch({ selfService: { outages: { pushover: false } } })
  await form.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(form.getByRole('status')).toHaveText('Pushover API OK')
})

test('a conflict preserves the draft, shows the saved title and saves again with the new version', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('pushover-configured')
  await page.goto('account/push-notifications')
  const form = page.locator('[data-push-form]')
  await form.locator('input[name="title"]').fill('Retained draft')
  await mockApi.patch({
    selfService: {
      mailboxes: {
        [mailbox]: { push: mockPushSettings({ title: 'Changed elsewhere', version: 2 }) },
      },
    },
  })
  await form.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(form.locator('[data-outdated]')).toContainText('Changed elsewhere')
  await expect(form.locator('input[name="title"]')).toHaveValue('Retained draft')
  await form.getByRole('button', { name: 'Save again', exact: true }).click()
  await expect(form.getByRole('status')).toContainText('Pushover')
  expect(await mockApi.countRequests('replacePushNotificationSettings')).toBe(2)
})

test('unsaved changes are guarded and own access without the pushover flag is refused', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('pushover-configured')
  await page.goto('account')
  await (await openAccountSections(page)).locator('a[href$="/account/push-notifications"]').click()
  await page.locator('input[name="title"]').fill('Unsaved')
  await page.goBack()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toContainText('Leave without saving?')
  await dialog.getByRole('button', { name: 'Stay', exact: true }).click()
  await expect(page.locator('input[name="title"]')).toHaveValue('Unsaved')
  await page.goBack()
  await dialog.getByRole('button', { name: 'Leave', exact: true }).click()
  await expect(page).toHaveURL(/\/account\/password$/)
  await mockApi.use('account-mailbox-no-flags')
  await page.goto('account/push-notifications')
  await expect(page.getByRole('heading', { name: 'No access', exact: true })).toBeVisible()
})
