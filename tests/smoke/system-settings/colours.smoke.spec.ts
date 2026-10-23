// UI013 T072: run only during a coordinated mutation window on the isolated local stack.
import { expect, test } from '@playwright/test'
import type { BrandColors, PublicConfig } from '@/api'
import { csrfToken, requireLocalStack } from '../fixtures/account-api'
import { admin } from '../fixtures/accounts'
import { expectHome, signIn, signOut } from '../fixtures/flows'

test('@013 @local-stack administrator changes, clears and restores brand colours', async ({
  page,
  baseURL,
}) => {
  requireLocalStack(baseURL)
  await signIn(page, admin.username, admin.password)
  await expectHome(page, admin.username)
  const read = await page.request.get('/api/v2/settings/brand-colors')
  expect(read.status()).toBe(200)
  const before = ((await read.json()) as { data: BrandColors }).data
  try {
    await page.goto('system/customize/colours')
    const section = page.locator('#section-brand-colours')
    await section.getByRole('button', { name: /^Edit / }).click()
    await page.locator('#brand-colour-light').fill('#1d4ed8')
    await page.locator('#brand-colour-dark').fill('')
    await section.getByRole('button', { name: 'Save changes', exact: true }).click()
    await expect(section.locator('form')).toHaveCount(0)
    const publicResponse = await page.request.get('/api/v2/public-config')
    expect(publicResponse.status()).toBe(200)
    expect(((await publicResponse.json()) as { data: PublicConfig }).data.brandColors).toEqual({
      light: { color: '#1d4ed8', foreground: '#ffffff' },
      dark: { color: '#1d4ed8', foreground: '#ffffff' },
    })
    await section.getByRole('button', { name: /^Edit / }).click()
    await page.locator('#brand-colour-light').fill('')
    await section.getByRole('button', { name: 'Save changes', exact: true }).click()
    await expect(section.locator('form')).toHaveCount(0)
    const cleared = await page.request.get('/api/v2/public-config')
    expect(((await cleared.json()) as { data: PublicConfig }).data.brandColors).toEqual({
      light: null,
      dark: null,
    })
  } finally {
    const currentResponse = await page.request.get('/api/v2/settings/brand-colors')
    expect(currentResponse.status()).toBe(200)
    const current = ((await currentResponse.json()) as { data: BrandColors }).data
    if (current.light !== before.light || current.dark !== before.dark) {
      const restored = await page.request.patch('/api/v2/settings/brand-colors', {
        headers: {
          'X-CSRF-Token': await csrfToken(page),
          'If-Match': current.etag,
          'Content-Type': 'application/merge-patch+json',
        },
        data: { light: before.light, dark: before.dark },
      })
      expect(restored.status(), 'Restore original brand colours').toBe(200)
      expect(((await restored.json()) as { data: BrandColors }).data).toMatchObject({
        light: before.light,
        dark: before.dark,
      })
    }
  }
  await signOut(page)
})
