import { expect, test } from '../../fixtures/test'
import { settingsCapabilities } from '../../../mocks/factories/settings'

test('FR-045/046 reset defaults and availability are readable; legacy field order and copies stay accessible', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
  expectTouchTargets,
}) => {
  await mockApi.use('password-defaults')
  await page.goto('system/password-policy')
  const section = page.locator('#password-reset-email')
  await expect(section.locator('[data-reset-availability]')).toContainText('unavailable')
  await expect(section.locator('[data-default-template]')).toHaveCount(2)
  await section.getByRole('button', { name: 'Edit Password Recovery Settings' }).click()
  await expect(section.locator('input[name]')).toHaveCount(2)
  expect(
    await section
      .locator('input[name]')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('name'))),
  ).toEqual(['sender', 'subject'])
  await expect(section.getByRole('button', { name: /^Copy / })).toHaveCount(6)
  await page.evaluate(() =>
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: () => Promise.reject(new Error('refused')),
      },
    }),
  )
  await section.getByRole('button', { name: 'Copy {{link}}', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe('{{link}}')
  await expectAccessible()
  await expectNoHorizontalScroll()
  await expectTouchTargets()
})

test('US5-AS3 reset sender and subject validate before any request', async ({ page, mockApi }) => {
  await mockApi.use('password-reset-available')
  await page.goto('system/password-policy')
  await page.getByRole('button', { name: 'Edit Password Recovery Settings' }).click()
  await page.locator('#reset-sender').fill('no-reply@')
  await page
    .locator('#section-password-reset')
    .getByRole('button', { name: 'Save changes', exact: true })
    .click()
  await expect(page.locator('#reset-sender')).toHaveAttribute('aria-invalid', 'true')
  await page.locator('#reset-sender').fill('support@example.org')
  await page.locator('#reset-subject').fill('x'.repeat(256))
  await page
    .locator('#section-password-reset')
    .getByRole('button', { name: 'Save changes', exact: true })
    .click()
  await expect(page.locator('#reset-subject')).toHaveAttribute('aria-invalid', 'true')
  expect(await mockApi.countRequests('updatePasswordResetNotification')).toBe(0)
})

test('US5-AS5 clearing the subject asks before disabling reset for everyone', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('password-reset-available')
  await page.goto('system/password-policy')
  await page.getByRole('button', { name: 'Edit Password Recovery Settings' }).click()
  await page.locator('#reset-subject').fill('')
  const save = page
    .locator('#section-password-reset')
    .getByRole('button', { name: 'Save changes', exact: true })
  await save.click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toContainText('every user')
  await expectAccessible()
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  expect(await mockApi.countRequests('updatePasswordResetNotification')).toBe(0)
  await expect(page.locator('#reset-subject')).toHaveValue('')
  await save.click()
  await dialog.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.locator('[data-reset-availability]')).toContainText('unavailable')
  const writes = (await mockApi.requests()).filter(
    (request) => request.operationId === 'updatePasswordResetNotification',
  )
  expect(writes).toHaveLength(1)
  expect(writes[0]!.body).toEqual({ subject: '' })
})

test('US5-AS6 restoring templates empties both and saving returns marked defaults', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('password-reset-custom')
  await page.goto('system/password-policy')
  await page.getByRole('button', { name: 'Edit Password Recovery Settings' }).click()
  await page.getByRole('button', { name: 'Restore default templates' }).click()
  await expect(page.locator('[data-reset-form]')).toContainText(
    'default templates will apply after saving',
  )
  await page
    .locator('#section-password-reset')
    .getByRole('button', { name: 'Save changes', exact: true })
    .click()
  await expect(page.locator('[data-default-template]')).toHaveCount(2)
  const write = (await mockApi.requests()).find(
    (request) => request.operationId === 'updatePasswordResetNotification',
  )!
  expect(write.body).toEqual({ textTemplate: '', htmlTemplate: '' })
  await expect(page.locator('#section-password-reset [role="status"]')).toBeVisible()
})

test('FR-048 missing-link and single-template warnings do not block a custom save', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('password-reset-custom')
  await page.goto('system/password-policy')
  await page.getByRole('button', { name: 'Edit Password Recovery Settings' }).click()
  const form = page.locator('[data-reset-form]')
  await form.locator('summary').filter({ hasText: 'Text Template' }).click()
  await form.locator('summary').filter({ hasText: 'HTML Template' }).click()
  await page.locator('#reset-textTemplate').fill('Contact support')
  await page.locator('#reset-htmlTemplate').fill('')
  await expect(page.locator('[data-template-warning]')).toContainText('no reset link')
  await expect(page.locator('[data-template-warning]')).toContainText('Only one template')
  await page
    .locator('#section-password-reset')
    .getByRole('button', { name: 'Save changes', exact: true })
    .click()
  await expect(page.locator('[data-reset-form]')).toHaveCount(0)
  await expect(page.locator('[data-template-warning]')).toContainText('no reset link')
  expect(
    (await mockApi.requests()).find(
      (request) => request.operationId === 'updatePasswordResetNotification',
    )!.body,
  ).toEqual({ textTemplate: 'Contact support', htmlTemplate: '' })
})

test('FR-011 conflict keeps templates and an explicit retry preserves the changed sender', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('password-reset-custom')
  await page.goto('system/password-policy')
  await page.getByRole('button', { name: 'Edit Password Recovery Settings' }).click()
  await page.locator('#reset-subject').fill('A new subject')
  await mockApi.patch({
    settings: { passwordReset: { sender: 'changed@example.org', etag: '"reset-other"' } },
  })
  await page
    .locator('#section-password-reset')
    .getByRole('button', { name: 'Save changes', exact: true })
    .click()
  await expect(page.locator('[data-outdated]')).toContainText('changed@example.org')
  await expect(page.locator('#reset-subject')).toHaveValue('A new subject')
  await page.getByRole('button', { name: 'Save again', exact: true }).click()
  await expect(page.locator('[data-reset-form]')).toHaveCount(0)
  await expect(page.locator('#section-password-reset')).toContainText('changed@example.org')
  const writes = (await mockApi.requests()).filter(
    (request) => request.operationId === 'updatePasswordResetNotification',
  )
  expect(writes[1]!.body).toEqual({ subject: 'A new subject' })
  expect(writes[1]!.headers['if-match']).toBe('"reset-other"')
})

test('FR-072 UTF-8 size errors open the editor, preserve input and keep sideways scroll inside it', async ({
  page,
  mockApi,
  expectNoHorizontalScroll,
  expectAccessible,
}) => {
  const caps = settingsCapabilities()
  caps.limits.templateMaxBytes = 200
  await mockApi.use('password-reset-custom', { settings: { capabilities: caps } })
  await page.goto('system/password-policy')
  await page.getByRole('button', { name: 'Edit Password Recovery Settings' }).click()
  const panel = page.locator('[data-reset-form] details').first()
  await panel.locator('summary').click()
  await page.locator('#reset-textTemplate').fill('é'.repeat(95))
  await expect(panel.getByRole('status')).toContainText('200')
  await page.locator('#reset-textTemplate').fill('x'.repeat(201))
  await panel.getByRole('checkbox', { name: 'Wrap long lines' }).uncheck()
  await panel.locator('summary').click()
  await page
    .locator('#section-password-reset')
    .getByRole('button', { name: 'Save changes', exact: true })
    .click()
  await expect(page.locator('#reset-textTemplate')).toHaveAttribute('aria-invalid', 'true')
  await expect(page.locator('#reset-textTemplate')).toBeVisible()
  await expect(page.locator('#reset-textTemplate')).toHaveValue('x'.repeat(201))
  await expectNoHorizontalScroll()
  await expectAccessible()
  expect(await mockApi.countRequests('updatePasswordResetNotification')).toBe(0)
})

test('FR-017/091 demo reset settings stay readable and History has the reset target', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('settings-demo-mode')
  await page.goto('system/password-policy')
  await expect(page.locator('[data-reset-availability]')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Edit Password Recovery Settings' })).toHaveCount(0)
  await expectAccessible()
  await page
    .locator('#section-password-reset')
    .getByRole('link', { name: 'History', exact: true })
    .click()
  await expect(page).toHaveURL(/targetType=passwordResetNotification/)
})
