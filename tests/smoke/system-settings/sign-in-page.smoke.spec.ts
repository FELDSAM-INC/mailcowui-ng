// T081: reversible local-only customization, with public configuration checked after restoration.
import { expect, test } from '@playwright/test'
import type { LoginPageSettings, PublicConfig } from '@/api'
import { csrfToken, requireLocalStack } from '../fixtures/account-api'
import { admin } from '../fixtures/accounts'
import { expectHome, signIn, signOut } from '../fixtures/flows'

test('@013 @local-stack administrator changes and restores the domain administrator login link', async ({
  page,
  baseURL,
}) => {
  requireLocalStack(baseURL)
  await signIn(page, admin.username, admin.password)
  await expectHome(page, admin.username)
  const read = await page.request.get('/api/v2/settings/login-page')
  expect(read.status()).toBe(200)
  const before = ((await read.json()) as { data: LoginPageSettings }).data
  try {
    await page.goto('system/customize/login-page')
    const section = page.locator('#section-sign-in-links')
    await section.getByRole('button', { name: /^Edit / }).click()
    await page.locator('#login-page-hideDomainAdminLogin').setChecked(!before.hideDomainAdminLogin)
    await section.getByRole('button', { name: 'Save changes', exact: true }).click()
    await expect(section.locator('form')).toHaveCount(0)
    const config = await page.request.get('/api/v2/public-config')
    expect(config.status()).toBe(200)
    expect(
      ((await config.json()) as { data: PublicConfig }).data.loginPage.hideDomainAdminLogin,
    ).toBe(!before.hideDomainAdminLogin)
  } finally {
    const currentRead = await page.request.get('/api/v2/settings/login-page')
    expect(currentRead.status()).toBe(200)
    const current = ((await currentRead.json()) as { data: LoginPageSettings }).data
    if (current.hideDomainAdminLogin !== before.hideDomainAdminLogin) {
      const restored = await page.request.patch('/api/v2/settings/login-page', {
        headers: {
          'X-CSRF-Token': await csrfToken(page),
          'If-Match': current.etag,
          'Content-Type': 'application/merge-patch+json',
        },
        data: { hideDomainAdminLogin: before.hideDomainAdminLogin },
      })
      expect(restored.status(), 'Restore local login-page flag').toBe(200)
    }
    const config = await page.request.get('/api/v2/public-config')
    expect(config.status()).toBe(200)
    const login = ((await config.json()) as { data: PublicConfig }).data.loginPage
    expect(login).toEqual({
      hideAdminLogin: before.hideAdminLogin,
      hideDomainAdminLogin: before.hideDomainAdminLogin,
      hideMailboxUserLogin: before.hideMailboxUserLogin,
      forceSingleSignOn: before.forceSingleSignOn,
    })
  }
  await signOut(page)
})
