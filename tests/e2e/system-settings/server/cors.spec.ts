import { expect, test } from '../../fixtures/test'
const edit = 'Edit CORS Settings'
test('legacy controls normalize pasted origins and save only changed lists with a version', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('settings-admin-defaults')
  await page.goto('system/cors')
  await expect(page.getByText(/apply only to the classic \/api\/v1/)).toBeVisible()
  await page.getByRole('button', { name: edit, exact: true }).click()
  const origins = page.getByLabel('Access-Control-Allow-Origin', { exact: true })
  await expect(origins).toHaveAttribute('autocapitalize', 'off')
  const methods = page.getByLabel('Access-Control-Allow-Methods', { exact: true })
  expect(await methods.locator('option').allTextContents()).toEqual([
    'POST',
    'GET',
    'DELETE',
    'PUT',
  ])
  await origins.fill('HTTPS://Portal.EXAMPLE.ORG; https://portal.example.org\n*')
  await methods.selectOption(['POST', 'GET'])
  await expect(page.locator('[data-cors-wildcard]')).toBeVisible()
  await expectNoHorizontalScroll()
  await expectAccessible()
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.getByText('CORS settings have been saved', { exact: true })).toBeVisible()
  const request = (await mockApi.requests()).find(
    (r) => r.operationId === 'updateLegacyApiCorsSettings',
  )!
  expect(request.headers['if-match']).toBe('"cors-1"')
  expect(request.body).toEqual({
    allowedOrigins: ['https://portal.example.org', '*'],
    allowedMethods: ['POST', 'GET'],
  })
  await page.reload()
  await expect(page.locator('[data-cors-value]')).toContainText('https://portal.example.org')
})
test('blocks paths, an empty method selection and too many origins before sending', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('settings-admin-defaults')
  await mockApi.patch({
    settings: {
      capabilities: {
        limits: {
          ...(await import('../../../mocks/factories/settings')).settingsCapabilities().limits,
          corsOriginsMax: 2,
        },
      },
    },
  })
  await page.goto('system/cors')
  await page.getByRole('button', { name: edit, exact: true }).click()
  const origins = page.getByLabel('Access-Control-Allow-Origin', { exact: true }),
    methods = page.getByLabel('Access-Control-Allow-Methods', { exact: true })
  await origins.fill('https://portal.example.org/app/')
  await methods.selectOption([])
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(origins).toHaveAttribute('aria-invalid', 'true')
  await expect(methods).toHaveAttribute('aria-invalid', 'true')
  await origins.fill('https://a.example.org\nhttps://b.example.org\nhttps://c.example.org')
  await methods.selectOption(['GET'])
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(origins).toHaveAttribute('aria-invalid', 'true')
  expect(
    (await mockApi.requests()).filter((r) => r.operationId === 'updateLegacyApiCorsSettings'),
  ).toHaveLength(0)
})
test('stored bare hosts remain visible and must be corrected before even a methods-only save', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('cors-legacy-bare-host')
  await page.goto('system/cors')
  await expect(page.locator('[data-cors-value]')).toContainText('old.example.org')
  await page.getByRole('button', { name: edit, exact: true }).click()
  await expect(page.getByText(/Invalid Allow-Origin specified: old[.]example[.]org/)).toBeVisible()
  await page.getByLabel('Access-Control-Allow-Methods', { exact: true }).selectOption(['POST'])
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  expect(
    (await mockApi.requests()).some((r) => r.operationId === 'updateLegacyApiCorsSettings'),
  ).toBe(false)
  await page.getByLabel('Access-Control-Allow-Origin', { exact: true }).fill('')
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.locator('[data-cors-value]')).toContainText('https://mail.example.org')
  expect(
    (await mockApi.requests()).find((r) => r.operationId === 'updateLegacyApiCorsSettings')?.body,
  ).toEqual({ allowedOrigins: [], allowedMethods: ['POST'] })
})
test('outdated settings retain the draft and require an explicit retry against the fresh version', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('settings-admin-defaults')
  await page.goto('system/cors')
  await page.getByRole('button', { name: edit, exact: true }).click()
  const origins = page.getByLabel('Access-Control-Allow-Origin', { exact: true })
  await origins.fill('https://draft.example.org')
  await mockApi.patch({
    settings: { cors: { allowedOrigins: ['https://someone.example.org'], etag: '"cors-new"' } },
  })
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Save again', exact: true })).toBeVisible()
  await expect(origins).toHaveValue('https://draft.example.org')
  expect(
    (await mockApi.requests()).filter((r) => r.operationId === 'updateLegacyApiCorsSettings'),
  ).toHaveLength(1)
  await page.getByRole('button', { name: 'Save again', exact: true }).click()
  await expect(page.getByText('CORS settings have been saved', { exact: true })).toBeVisible()
  expect(
    (await mockApi.requests()).filter((r) => r.operationId === 'updateLegacyApiCorsSettings')[1]
      ?.headers['if-match'],
  ).toBe('"cors-new"')
})
test('read failures retry and dirty navigation asks before discarding the origins', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('settings-admin-defaults')
  await mockApi.failNext('getLegacyApiCorsSettings', { status: 500 })
  await page.goto('system/cors')
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await page.getByRole('button', { name: edit, exact: true }).click()
  await page
    .getByLabel('Access-Control-Allow-Origin', { exact: true })
    .fill('https://unsaved.example.org')
  await page.getByRole('link', { name: 'System settings', exact: true }).click()
  await expect(page.getByRole('alertdialog')).toBeVisible()
})
for (const scenario of ['settings-domain-admin', 'settings-mailbox-user'])
  test(`denies both integration pages to ${scenario}`, async ({ page, mockApi }) => {
    await mockApi.use(scenario)
    for (const route of ['cors', 'license']) {
      await page.goto(`system/${route}`)
      await expect(page.getByRole('heading', { name: 'No access', exact: true })).toBeVisible()
    }
    expect(
      (await mockApi.requests()).some((r) =>
        ['getLegacyApiCorsSettings', 'getLicenseStatus'].includes(r.operationId ?? ''),
      ),
    ).toBe(false)
  })
