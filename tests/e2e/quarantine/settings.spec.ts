import { expect, test } from '../fixtures/test'

test('US7 quarantine settings save one merge patch with MiB conversion and version', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('quarantine-settings-active')
  await page.goto('quarantine/settings')
  const section = page.locator('#section-quarantine-settings')
  await section.getByRole('button', { name: /^Edit / }).click()
  await page.locator('#quarantine-settings-retentionPerMailbox').fill('0')
  await page.locator('#quarantine-settings-maxMessageSize').fill('12')
  await page.locator('#quarantine-settings-redirectRecipient').fill('review@example.org')
  await expectAccessible()
  await section.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.locator('[data-quarantine-inactive]')).toBeVisible()
  const writes = (await mockApi.requests()).filter(
    (r) => r.operationId === 'updateQuarantineSettings',
  )
  expect(writes).toHaveLength(1)
  expect(writes[0]!.body).toEqual({
    retentionPerMailbox: 0,
    maxMessageSize: 12 * 1024 * 1024,
    redirectRecipient: 'review@example.org',
  })
  expect(writes[0]!.headers['if-match']).toBeTruthy()
})

test('US7 template syntax stays inert, errors keep input, and empty restores the default', async ({
  page,
  mockApi,
  expectAccessible,
  guardRequests,
}) => {
  void guardRequests
  await mockApi.use('quarantine-settings-custom')
  await page.goto('quarantine/settings')
  const section = page.locator('#section-quarantine-settings')
  await section.getByRole('button', { name: /^Edit / }).click()
  await section.locator('[data-template-toggle]').click()
  const template = page.locator('#quarantine-settings-notificationTemplate')
  await template.fill('{% for x in meta %}')
  await section.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(template).toHaveAttribute('aria-invalid', 'true')
  await expect(template).toHaveValue('{% for x in meta %}')
  await expectAccessible()
  await template.fill('')
  await section.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(section.getByRole('button', { name: /^Edit / })).toBeVisible()
  const writes = (await mockApi.requests()).filter(
    (r) => r.operationId === 'updateQuarantineSettings',
  )
  expect(writes.at(-1)!.body).toEqual({ notificationTemplate: null })
})
