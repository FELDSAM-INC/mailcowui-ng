import { expect, test } from '../../fixtures/test'
const verify = 'Validate GUID against license server'
test('reads/copies the GUID and verifies explicitly with visible progress and the complete result', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('settings-license-valid')
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: (value: string) => {
          document.documentElement.dataset.copied = value
          return Promise.resolve()
        },
      },
    }),
  )
  await page.goto('system/license')
  await expect(page.locator('[data-license-guid]')).toHaveText('a'.repeat(64))
  expect((await mockApi.requests()).some((r) => r.operationId === 'verifyLicense')).toBe(false)
  await page.getByRole('button', { name: 'Copy GUID', exact: true }).click()
  expect(await page.locator('html').getAttribute('data-copied')).toBe('a'.repeat(64))
  await expect(page.getByText(/Only the GUID is sent/)).toBeVisible()
  await mockApi.delay('verifyLicense', 500)
  await page.getByRole('button', { name: verify, exact: true }).click()
  await expect(page.getByRole('button', { name: verify, exact: true })).toBeDisabled()
  await expect(page.getByText('Verifying the GUID…', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: verify, exact: true })).toBeEnabled()
  await expect(page.locator('[data-license-result]')).toContainText('customer-123')
  await expect(page.locator('[data-license-result]')).toContainText('service-456')
  await expect(page.locator('[data-license-result]')).toContainText('Support level2')
  expect((await mockApi.requests()).filter((r) => r.operationId === 'verifyLicense')).toHaveLength(
    1,
  )
  await expectNoHorizontalScroll()
  await expectAccessible()
})
test('unreachable is a verification result with a retry action, not an error', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('settings-license-unreachable')
  await page.goto('system/license')
  await page.getByRole('button', { name: verify, exact: true }).click()
  await expect(page.locator('[data-license-result]')).toContainText('License service unreachable')
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByRole('button', { name: verify, exact: true })).toBeEnabled()
})
test('disabled license is hidden from the catalogue and direct navigation sends no license request', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('settings-license-disabled')
  await page.goto('system')
  await expect(page.locator('[data-settings-overview]')).toBeVisible()
  await expect(page.getByRole('link', { name: /GUID & License/ })).toHaveCount(0)
  await page.goto('system/license')
  await expect(page.getByRole('heading', { name: 'Page not found', exact: true })).toBeVisible()
  expect(
    (await mockApi.requests()).some((r) =>
      ['getLicenseStatus', 'verifyLicense'].includes(r.operationId ?? ''),
    ),
  ).toBe(false)
})
test('a feature-disabled verification refreshes capabilities and removes the page', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('settings-license-valid')
  await page.goto('system/license')
  await expect(page.locator('[data-license-guid]')).toBeVisible()
  await mockApi.patch({ settings: { capabilities: { licenseVerificationEnabled: false } } })
  await page.getByRole('button', { name: verify, exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Page not found', exact: true })).toBeVisible()
  expect(
    (await mockApi.requests()).filter((r) => r.operationId === 'getSettingsCapabilities').length,
  ).toBeGreaterThan(1)
  await page.getByRole('link', { name: 'System settings', exact: true }).click()
  await expect(page.getByRole('link', { name: /GUID & License/ })).toHaveCount(0)
})
test('a marked-invalid GUID can still be verified and displays the invalid result', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('settings-license-guid-invalid')
  await page.goto('system/license')
  await expect(page.locator('[data-invalid-guid]')).toHaveText(
    'The GUID is marked invalid by mailcow.',
  )
  await expect(page.getByRole('button', { name: 'Copy GUID', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: verify, exact: true }).click()
  await expect(page.locator('[data-license-result]')).toContainText('Invalid')
})
test('failed reads are recoverable and an unverified license is clearly described', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('settings-license-valid')
  await mockApi.patch({
    settings: {
      license: {
        lastVerification: {
          result: 'neverVerified',
          verifiedAt: null,
          customerId: null,
          serviceId: null,
          supportLevel: null,
        },
      },
    },
  })
  await mockApi.failNext('getLicenseStatus', { status: 500 })
  await page.goto('system/license')
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(page.locator('[data-license-result]')).toContainText('Never verified')
  expect((await mockApi.requests()).some((r) => r.operationId === 'verifyLicense')).toBe(false)
})
