// UI013 T153 (IP-check slice): the isolated stack only, with the original opt-in restored.
import { expect, test } from '@playwright/test'
import type { IpCheckSetting, SettingsCapabilities } from '@/api'

import { csrfToken, requireLocalStack } from '../fixtures/account-api'
import { admin } from '../fixtures/accounts'
import { expectHome, signIn, signOut } from '../fixtures/flows'

test('@013 @local-stack administrator toggles the IP check and restores the stored setting', async ({
  page,
  baseURL,
}) => {
  requireLocalStack(baseURL)
  await signIn(page, admin.username, admin.password)
  await expectHome(page, admin.username)
  const capsResponse = await page.request.get('/api/v2/capabilities/settings')
  expect(capsResponse.status()).toBe(200)
  const caps = ((await capsResponse.json()) as { data: SettingsCapabilities }).data
  expect(caps.demoMode, 'The isolated stack allows reversible settings changes').toBe(false)
  const beforeResponse = await page.request.get('/api/v2/settings/ip-check')
  expect(beforeResponse.status()).toBe(200)
  const before = ((await beforeResponse.json()) as { data: IpCheckSetting }).data
  try {
    await page.goto('system/ip-check')
    await expect(page.locator('[data-ip-check-value]')).toHaveText(before.enabled ? 'Yes' : 'No')
    await page.getByRole('button', { name: 'Edit IP Check', exact: true }).click()
    await page.getByRole('checkbox').setChecked(!before.enabled)
    await page.getByRole('button', { name: 'Save changes', exact: true }).click()
    await expect(page.locator('[data-ip-check-value]')).toHaveText(before.enabled ? 'No' : 'Yes')
    const afterResponse = await page.request.get('/api/v2/settings/ip-check')
    expect(afterResponse.status()).toBe(200)
    const after = ((await afterResponse.json()) as { data: IpCheckSetting }).data
    expect(after.enabled).toBe(!before.enabled)
    expect(after.etag).not.toBe(before.etag)
    await page.reload()
    await expect(page.locator('[data-ip-check-value]')).toHaveText(before.enabled ? 'No' : 'Yes')
  } finally {
    const read = await page.request.get('/api/v2/settings/ip-check')
    expect(read.status()).toBe(200)
    const current = ((await read.json()) as { data: IpCheckSetting }).data
    if (current.enabled !== before.enabled) {
      const restored = await page.request.patch('/api/v2/settings/ip-check', {
        headers: {
          'X-CSRF-Token': await csrfToken(page),
          'If-Match': current.etag,
          'Content-Type': 'application/merge-patch+json',
        },
        data: { enabled: before.enabled },
      })
      expect(restored.status(), 'Restore the isolated stack IP-check setting').toBe(200)
      expect(((await restored.json()) as { data: IpCheckSetting }).data.enabled).toBe(
        before.enabled,
      )
    }
  }
  await signOut(page)
})
