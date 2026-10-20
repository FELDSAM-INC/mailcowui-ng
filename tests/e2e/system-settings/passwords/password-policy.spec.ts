import { expect, test } from '../../fixtures/test'
import { openNavigation } from '../../fixtures/flows'

test('FR-043/044/109 policy saves changed rules and the next mailbox form sees them', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
  expectTouchTargets,
}) => {
  await mockApi.use('settings-admin-defaults')
  await page.goto('dns/dkim-keys')
  await expect(page.getByRole('heading', { level: 1, name: 'ARC/DKIM keys' })).toBeVisible()
  const tabs = page.locator('[data-section-navigation]')
  const disclosure = tabs.getByRole('button')
  if (await disclosure.isVisible()) await disclosure.click()
  await tabs.getByRole('link', { name: 'Password Settings' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Password Settings' })).toBeVisible()
  await expect(page.locator('[data-policy-length]')).toHaveText('6')
  await expectAccessible()
  await page.getByRole('button', { name: 'Edit Password policy' }).click()
  await page.locator('#policy-minLength').fill('10')
  await page.locator('#policy-requireMixedCase').check()
  await page.locator('#policy-requireDigits').check()
  await expect(page.locator('[data-policy-rules]')).toContainText('Minimum password length is 10')
  await expect(page.locator('[data-policy-rules]')).toContainText(
    'Must contain at least one number',
  )
  await expect(page.locator('[data-policy-rules]')).toContainText(
    'Must contain lowercase and uppercase characters',
  )
  await expect(page.getByText('Existing passwords keep working.', { exact: false })).toBeVisible()
  await expectAccessible()
  await expectTouchTargets()
  await expectNoHorizontalScroll()
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.locator('#section-policy [role="status"]')).toHaveText(
    'Password policy was saved successfully',
  )
  const writes = (await mockApi.requests()).filter(
    (request) => request.operationId === 'updatePasswordPolicy',
  )
  expect(writes).toHaveLength(1)
  expect(writes[0]!.body).toEqual({ minLength: 10, requireMixedCase: true, requireDigits: true })
  expect(writes[0]!.headers['if-match']).toMatch(/^"[^"\s]+"$/)
  // Client-side navigation preserves the shared query cache and needs no page reload.
  const navigation = await openNavigation(page)
  await navigation.getByRole('link', { name: 'Mailboxes', exact: true }).click()
  await page.getByRole('link', { name: 'Add mailbox', exact: true }).first().click()
  await expect(page.locator('[data-mailbox-form]')).toContainText('Minimum password length is 10')
  await expect(page.locator('[data-mailbox-form]')).toContainText(
    'Must contain at least one number',
  )
})

test('FR-043 rejects empty, fractional and out-of-range lengths before any write', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('settings-admin-defaults')
  await page.goto('system/password-policy')
  await page.getByRole('button', { name: 'Edit Password policy' }).click()
  for (const value of ['2', '65', '3.5', '']) {
    await page.locator('#policy-minLength').fill(value)
    await page.getByRole('button', { name: 'Save changes', exact: true }).click()
    await expect(page.locator('#policy-minLength')).toHaveAttribute('aria-invalid', 'true')
    await expect(page.locator('#policy-minLength')).toHaveValue(value)
    await expect(page.locator('#section-policy')).toContainText('3')
    await expect(page.locator('#section-policy')).toContainText('64')
  }
  expect(await mockApi.countRequests('updatePasswordPolicy')).toBe(0)
})

test('FR-011 stale policy keeps the draft and retries with the new version only on request', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('settings-admin-defaults')
  await page.goto('system/password-policy')
  await page.getByRole('button', { name: 'Edit Password policy' }).click()
  await page.locator('#policy-minLength').fill('12')
  await mockApi.patch({ passwordPolicy: { requireDigits: true } })
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.locator('[data-outdated]')).toBeVisible()
  await expect(page.locator('#policy-minLength')).toHaveValue('12')
  expect(await mockApi.countRequests('updatePasswordPolicy')).toBe(1)
  await expectAccessible()
  await page.getByRole('button', { name: 'Save again', exact: true }).click()
  await expect(page.locator('[data-policy-length]')).toHaveText('12')
  await expect(page.locator('[data-policy-rules]')).toContainText(
    'Must contain at least one number',
  )
  const writes = (await mockApi.requests()).filter(
    (request) => request.operationId === 'updatePasswordPolicy',
  )
  expect(writes[1]!.body).toEqual({ minLength: 12 })
  expect(writes[1]!.headers['if-match']).not.toBe(writes[0]!.headers['if-match'])
})

test('FR-010 policy errors retain entered values and a later save succeeds', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('settings-admin-defaults')
  await page.goto('system/password-policy')
  await page.getByRole('button', { name: 'Edit Password policy' }).click()
  await page.locator('#policy-minLength').fill('11')
  await mockApi.patch({
    failures: {
      updatePasswordPolicy: {
        status: 422,
        type: 'validation-failed',
        times: 1,
        errors: {
          minLength: [{ code: 'outOfRange', message: 'Out of range', params: { min: 3, max: 64 } }],
        },
      },
    },
  })
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.locator('#policy-minLength')).toHaveAttribute('aria-invalid', 'true')
  await expect(page.locator('#policy-minLength')).toHaveValue('11')
  await mockApi.failNext('updatePasswordPolicy', { status: 503 })
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.locator('[data-policy-form] [role="alert"]').first()).toBeVisible()
  await expect(page.locator('#policy-minLength')).toHaveValue('11')
  await expectAccessible()
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.locator('[data-policy-length]')).toHaveText('11')
})

test('FR-017 demo policy is readable and a newly enabled demo mode disables the open editor', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('settings-demo-mode')
  await page.goto('system/password-policy')
  await expect(page.locator('[data-demo-mode]')).toBeVisible()
  await expect(page.locator('[data-policy-length]')).toHaveText('6')
  await expect(page.getByRole('button', { name: 'Edit Password policy' })).toHaveCount(0)
  await mockApi.use('settings-admin-defaults')
  await page.reload()
  await page.getByRole('button', { name: 'Edit Password policy' }).click()
  await page.locator('#policy-minLength').fill('11')
  await mockApi.patch({ settings: { capabilities: { demoMode: true } } })
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.locator('[data-demo-mode]')).toBeVisible()
  await expect(page.locator('#policy-minLength')).toBeDisabled()
  await expect(page.locator('#policy-minLength')).toHaveValue('11')
  await expect(page.getByRole('button', { name: 'Save changes', exact: true })).toHaveCount(0)
  expect(await mockApi.countRequests('updatePasswordPolicy')).toBe(1)
})

for (const scenario of ['settings-domain-admin', 'settings-mailbox-user']) {
  test(`FR-001 ${scenario} cannot read or edit the administrator policy page`, async ({
    page,
    mockApi,
  }) => {
    await mockApi.use(scenario)
    await page.goto('system/password-policy')
    await expect(page.getByRole('heading', { name: 'No access' })).toBeVisible()
    expect(await mockApi.countRequests('getPasswordPolicy')).toBe(0)
    expect(await mockApi.countRequests('getSettingsCapabilities')).toBe(0)
    expect(await mockApi.countRequests('getPasswordResetNotification')).toBe(0)
    expect(await mockApi.countRequests('updatePasswordPolicy')).toBe(0)
  })
}

test('FR-013/094 policy dirty guard and history target remain scoped', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('settings-admin-defaults')
  await page.goto('system/password-policy')
  await page.getByRole('button', { name: 'Edit Password policy' }).click()
  await page.locator('#policy-minLength').fill('9')
  await page.locator('main header').getByRole('link', { name: 'History', exact: true }).click()
  await expect(page.getByRole('alertdialog')).toBeVisible()
  await expectAccessible()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Stay', exact: true }).click()
  await expect(page.locator('#policy-minLength')).toHaveValue('9')
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.locator('main header').getByRole('link', { name: 'History', exact: true }).click()
  await expect(page).toHaveURL(/targetType=passwordPolicy/)
})
