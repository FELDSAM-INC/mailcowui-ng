// UI013 T091: a reversible policy write against the isolated local stack only.
import { expect, test } from '@playwright/test'
import type { PasswordPolicy, SettingsCapabilities } from '@/api'

import { csrfToken, requireLocalStack } from '../fixtures/account-api'
import { admin } from '../fixtures/accounts'
import { expectHome, signIn, signOut } from '../fixtures/flows'

test('@013 @local-stack administrator changes and restores the password policy', async ({
  page,
  baseURL,
}) => {
  requireLocalStack(baseURL)
  await signIn(page, admin.username, admin.password)
  await expectHome(page, admin.username)
  const capsResponse = await page.request.get('/api/v2/capabilities/settings')
  expect(capsResponse.status()).toBe(200)
  const caps = ((await capsResponse.json()) as { data: SettingsCapabilities }).data
  expect(caps.demoMode).toBe(false)
  const beforeResponse = await page.request.get('/api/v2/password-policy')
  expect(beforeResponse.status()).toBe(200)
  const before = ((await beforeResponse.json()) as { data: PasswordPolicy }).data
  const nextLength =
    before.minLength < caps.limits.passwordPolicyMaxLength
      ? before.minLength + 1
      : before.minLength - 1
  try {
    await page.goto('system/password-policy')
    await expect(page.locator('[data-policy-length]')).toHaveText(String(before.minLength))
    await page.getByRole('button', { name: 'Edit Password policy' }).click()
    await page.locator('#policy-minLength').fill(String(nextLength))
    await page.getByRole('button', { name: 'Save changes', exact: true }).click()
    await expect(page.locator('[data-policy-length]')).toHaveText(String(nextLength))
    const afterResponse = await page.request.get('/api/v2/password-policy')
    expect(afterResponse.status()).toBe(200)
    const after = ((await afterResponse.json()) as { data: PasswordPolicy }).data
    expect(after).toEqual({ ...before, minLength: nextLength, etag: expect.any(String) })
    expect(after.etag).not.toBe(before.etag)
    await page.reload()
    await expect(page.locator('[data-policy-length]')).toHaveText(String(nextLength))
  } finally {
    const read = await page.request.get('/api/v2/password-policy')
    expect(read.status()).toBe(200)
    const current = ((await read.json()) as { data: PasswordPolicy }).data
    if (current.minLength !== before.minLength) {
      const restored = await page.request.patch('/api/v2/password-policy', {
        headers: {
          'X-CSRF-Token': await csrfToken(page),
          'If-Match': current.etag,
          'Content-Type': 'application/merge-patch+json',
        },
        data: { minLength: before.minLength },
      })
      expect(restored.status(), 'Restore the isolated stack password policy').toBe(200)
      expect(((await restored.json()) as { data: PasswordPolicy }).data).toEqual(before)
    }
  }
  await signOut(page)
})
