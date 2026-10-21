// UI013 T045: discovery and role boundaries against the isolated real API, without settings writes.
import { expect, test } from '@playwright/test'
import type { SettingsCapabilities } from '@/api'

import { requireLocalStack } from '../fixtures/account-api'
import { admin, reseller } from '../fixtures/accounts'
import { expectHome, signIn, signOut } from '../fixtures/flows'

test('@013 @local-stack administrator discovers the available settings and searches announcements', async ({
  page,
  baseURL,
}) => {
  requireLocalStack(baseURL)
  await signIn(page, admin.username, admin.password)
  await expectHome(page, admin.username)
  const response = await page.request.get('/api/v2/capabilities/settings')
  expect(response.status()).toBe(200)
  const capabilities = ((await response.json()) as { data: SettingsCapabilities }).data

  await page.goto('system')
  await expect(page.getByRole('heading', { level: 1, name: 'System settings' })).toBeVisible()
  const paths = [
    'cors',
    'customize/app-links',
    'customize/colours',
    'customize/login-page',
    'customize/logos',
    'customize/ui-texts',
    'filter-maps',
    'global-sieve-filters',
    'ip-check',
    'mass-mail/jobs',
    'mass-mail/send',
    'password-policy',
    'quota-notifications',
    'rspamd-rules',
    'rspamd-web-interface',
  ]
  if (capabilities.licenseVerificationEnabled) paths.push('license')
  const links = page.locator('[data-settings-overview] section a')
  await expect(links).toHaveCount(paths.length)
  expect(
    await links.evaluateAll((items) => items.map((item) => item.getAttribute('href')).sort()),
  ).toEqual(paths.map((path) => `/ng/system/${path}`).sort())

  await page.getByRole('searchbox', { name: 'Search settings' }).fill('announcement')
  const results = page.locator('[data-settings-results] a')
  await expect(results).toHaveCount(1)
  await results.click()
  await expect(page).toHaveURL(/\/system\/customize\/ui-texts#section-announcement$/)
  await expect(page.locator('#section-announcement h2')).toBeFocused()
  await signOut(page)
})

test('@013 @local-stack domain administrator cannot open system settings', async ({
  page,
  baseURL,
}) => {
  requireLocalStack(baseURL)
  await signIn(page, reseller.username, reseller.password)
  await expectHome(page, reseller.username)
  await page.goto('system')
  await expect(page.getByRole('heading', { level: 1, name: 'No access' })).toBeVisible()
  await expect(page.locator('[data-settings-overview]')).toHaveCount(0)
  await expect(page.getByRole('searchbox', { name: 'Search settings' })).toHaveCount(0)
  await signOut(page)
})
