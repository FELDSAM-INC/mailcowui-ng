import { expect, test } from '@playwright/test'
import type { LegacyApiCorsSettings, SettingsCapabilities, LicenseStatus } from '@/api'
import { csrfToken, requireLocalStack } from '../fixtures/account-api'
import { admin } from '../fixtures/accounts'
import { expectHome, signIn, signOut } from '../fixtures/flows'
test('@013 @local-stack saves CORS and restores exact stored lists', async ({ page, baseURL }) => {
  requireLocalStack(baseURL)
  await signIn(page, admin.username, admin.password)
  await expectHome(page, admin.username)
  const read = await page.request.get('/api/v2/settings/legacy-api-cors')
  expect(read.status()).toBe(200)
  const before = ((await read.json()) as { data: LegacyApiCorsSettings }).data
  const added = 'https://ui013-cors-smoke.invalid'
  const origins = [...new Set([...before.allowedOrigins, added])]
  try {
    await page.goto('system/cors')
    await page.getByRole('button', { name: 'Edit CORS Settings', exact: true }).click()
    await page.getByLabel('Access-Control-Allow-Origin', { exact: true }).fill(origins.join('\n'))
    await page.getByRole('button', { name: 'Save changes', exact: true }).click()
    await expect(page.getByText('CORS settings have been saved', { exact: true })).toBeVisible()
    const after = await page.request.get('/api/v2/settings/legacy-api-cors')
    expect(after.status()).toBe(200)
    expect(((await after.json()) as { data: LegacyApiCorsSettings }).data.allowedOrigins).toEqual(
      origins,
    )
  } finally {
    const read = await page.request.get('/api/v2/settings/legacy-api-cors')
    expect(read.status()).toBe(200)
    const current = ((await read.json()) as { data: LegacyApiCorsSettings }).data
    const restored = await page.request.patch('/api/v2/settings/legacy-api-cors', {
      headers: {
        'X-CSRF-Token': await csrfToken(page),
        'If-Match': current.etag,
        'Content-Type': 'application/merge-patch+json',
      },
      data: { allowedOrigins: before.allowedOrigins, allowedMethods: before.allowedMethods },
    })
    expect(restored.status(), 'Restore original CORS lists').toBe(200)
    const final = ((await restored.json()) as { data: LegacyApiCorsSettings }).data
    expect(final.allowedOrigins).toEqual(before.allowedOrigins)
    expect(final.allowedMethods).toEqual(before.allowedMethods)
  }
  await signOut(page)
})
test('@013 @local-stack reads license without contacting its verification service', async ({
  page,
  baseURL,
}) => {
  requireLocalStack(baseURL)
  await signIn(page, admin.username, admin.password)
  await expectHome(page, admin.username)
  const capabilities = await page.request.get('/api/v2/capabilities/settings')
  expect(capabilities.status()).toBe(200)
  const caps = ((await capabilities.json()) as { data: SettingsCapabilities }).data
  const writes: string[] = []
  page.on('request', (request) => {
    if (request.url().endsWith('/license/verification')) writes.push(request.method())
  })
  await page.goto('system/license')
  if (!caps.licenseVerificationEnabled)
    await expect(page.getByRole('heading', { name: 'Page not found', exact: true })).toBeVisible()
  else {
    const response = await page.request.get('/api/v2/license')
    expect(response.status()).toBe(200)
    const license = ((await response.json()) as { data: LicenseStatus }).data
    if (license.guidValid && license.guid)
      await expect(page.locator('[data-license-guid]')).toHaveText(license.guid)
    else await expect(page.locator('[data-invalid-guid]')).toBeVisible()
    await expect(page.locator('[data-license-result]')).toBeVisible()
  }
  expect(writes).toEqual([])
  await signOut(page)
})
