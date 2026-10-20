// Read and validate only; never save a script or restart Dovecot in this smoke.
import { expect, test } from '@playwright/test'
import type { GlobalSieveFilter } from '@/api'
import { requireLocalStack } from '../fixtures/account-api'
import { admin } from '../fixtures/accounts'
import { expectHome, signIn } from '../fixtures/flows'
test('@013 @local-stack checks both global scripts without changing versions or restarting', async ({
  page,
  baseURL,
}) => {
  requireLocalStack(baseURL)
  await page.route('**/api/v2/settings/global-sieve-filters/**', async (route) => {
    if (
      route.request().method() === 'PUT' &&
      new URL(route.request().url()).searchParams.get('validateOnly') !== 'true'
    ) {
      await route.abort()
      throw new Error('Real Sieve writes and restarts are forbidden in this smoke')
    }
    await route.continue()
  })
  await signIn(page, admin.username, admin.password)
  await expectHome(page, admin.username)
  const beforeRead = await page.request.get('/api/v2/settings/global-sieve-filters')
  expect(beforeRead.status()).toBe(200)
  const before = ((await beforeRead.json()) as { data: GlobalSieveFilter[] }).data
  expect(before.map((filter) => filter.id)).toEqual(['prefilter', 'postfilter'])
  await page.goto('system/global-sieve-filters')
  for (const filter of before) {
    const form = page.locator(`[data-global-filter=${filter.id}]`)
    await expect(form.locator('textarea')).toHaveValue(filter.script)
    await form.getByRole('button', { name: 'Validate', exact: true }).click()
    await expect(form.locator('[data-filter-notice]')).toContainText(
      'Nothing was saved or restarted',
    )
  }
  const after = await page.request.get('/api/v2/settings/global-sieve-filters')
  expect((await after.json()).data).toEqual(before)
})
