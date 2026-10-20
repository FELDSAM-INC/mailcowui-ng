// Read and validate only. Never change mail filtering in the shared development stack.
import { expect, test } from '@playwright/test'
import type { RspamdRegexMap, RspamdRegexMapSummary } from '@/api'
import { requireLocalStack } from '../fixtures/account-api'
import { admin } from '../fixtures/accounts'
import { expectHome, signIn } from '../fixtures/flows'
test('@013 @local-stack opens and checks a map without changing its contents or version', async ({
  page,
  baseURL,
}) => {
  requireLocalStack(baseURL)
  await page.route('**/api/v2/settings/rspamd-regex-maps/**', async (route) => {
    if (
      route.request().method() === 'PUT' &&
      new URL(route.request().url()).searchParams.get('validateOnly') !== 'true'
    ) {
      await route.abort()
      throw new Error('Real map writes are forbidden in this smoke')
    }
    await route.continue()
  })
  await signIn(page, admin.username, admin.password)
  await expectHome(page, admin.username)
  const list = await page.request.get('/api/v2/settings/rspamd-regex-maps')
  expect(list.status()).toBe(200)
  const entry = ((await list.json()) as { data: RspamdRegexMapSummary[] }).data.find(
    (map) => map.available,
  )
  expect(entry).toBeDefined()
  const beforeRead = await page.request.get(`/api/v2/settings/rspamd-regex-maps/${entry!.id}`)
  const before = ((await beforeRead.json()) as { data: RspamdRegexMap }).data
  await page.goto(`system/filter-maps/${entry!.id}`)
  await expect(page.locator('#regex-content')).toHaveValue(before.content)
  await page.getByRole('button', { name: 'Validate', exact: true }).click()
  await expect(page.locator('[data-map-notice]')).toHaveText('The map is valid. Nothing was saved.')
  const after = await page.request.get(`/api/v2/settings/rspamd-regex-maps/${entry!.id}`)
  expect((await after.json()).data).toEqual(before)
})
