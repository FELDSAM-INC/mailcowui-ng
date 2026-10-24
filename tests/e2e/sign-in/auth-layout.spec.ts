import type { Page } from '@playwright/test'
import { expect, test } from '../fixtures/test'
import {
  chooseAuthLanguage,
  chooseTheme,
  expectLanding,
  signInWithPassword,
} from '../fixtures/flows'

async function expectAuthLayout(page: Page) {
  const content = page.locator('[data-auth-content]')
  const branding = page.locator('[data-auth-branding]')
  const preferences = page.locator('[data-auth-preferences]')
  await expect(content).toBeVisible()
  await expect(branding.locator('[data-product-name]')).toHaveCount(1)
  await expect(branding).toBeVisible()
  await expect(preferences.locator('[data-language-select]')).toBeVisible()
  await expect(preferences.locator('[data-theme-select]')).toBeVisible()
  const formBox = (await content.boundingBox())!
  const brandBox = (await branding.boundingBox())!
  const preferencesBox = (await preferences.boundingBox())!
  expect(formBox.width).toBeLessThanOrEqual(448)
  if (page.viewportSize()!.width >= 1024) {
    await expect(branding.locator('[data-product-name]')).toBeHidden()
    await expect(branding.getByRole('img', { name: 'Example Mail' })).toHaveCSS('height', '128px')
    expect(formBox.x + formBox.width).toBeLessThan(brandBox.x)
    expect(preferencesBox.x + preferencesBox.width).toBeLessThan(brandBox.x)
  } else {
    await expect(branding.locator('[data-product-name]')).toBeVisible()
    await expect(branding.getByRole('img', { name: 'Example Mail' })).toHaveCSS('height', '48px')
    expect(preferencesBox.y + preferencesBox.height).toBeLessThanOrEqual(brandBox.y)
    expect(brandBox.y + brandBox.height).toBeLessThanOrEqual(formBox.y)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
}

test('sign-in has responsive branding and preference menus that preserve entered values', async ({
  page,
}) => {
  await page.goto('sign-in')
  await expectAuthLayout(page)
  await page.locator('input[name="username"]').fill('alice@example.org')
  await page.locator('input[name="password"]').fill('not-submitted')
  await page.screenshot({
    path: test.info().outputPath('sign-in-light.png'),
    fullPage: true,
    animations: 'disabled',
  })
  await chooseTheme(page, 'Dark')
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect(page.locator('[data-auth-branding] img')).toHaveAttribute('src', /logos\/dark/)
  await page.screenshot({
    path: test.info().outputPath('sign-in-dark.png'),
    fullPage: true,
    animations: 'disabled',
  })
  await chooseAuthLanguage(page, 'Čeština (Czech)')
  await expect(page.locator('html')).toHaveAttribute('lang', 'cs-CZ')
  await expect(page.locator('[data-language-select]')).toContainText('Čeština (Czech)')
  await expect(page.locator('[data-language-select]')).toContainText('🇨🇿')
  await expect(page.locator('input[name="username"]')).toHaveValue('alice@example.org')
  await expect(page.locator('input[name="password"]')).toHaveValue('not-submitted')
  await page.emulateMedia({ colorScheme: 'light' })
  await chooseTheme(page, 'Podle zařízení')
  await expect(page.locator('html')).not.toHaveClass(/dark/)
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('lang', 'cs-CZ')
  await expect(page.locator('html')).toHaveClass(/dark/)
})

test('reset request and new-password forms share the auth layout and controls', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('account-password-reset')
  await page.goto('reset-password/request')
  await expectAuthLayout(page)
  await page.getByLabel('Username').fill('carl@example.org')
  await chooseTheme(page, 'Dark')
  await expect(page.getByLabel('Username')).toHaveValue('carl@example.org')
  await page.getByRole('button', { name: 'Request password change' }).click()
  await expect(page.locator('[data-reset-requested]')).toBeVisible()
  await page.goto('reset-password?token=3F9A1C-0B7E22-9D4F10-A6C3E8-51B2D7')
  await expectAuthLayout(page)
  await expect(page.locator('[data-reset-password]')).toBeVisible()
  await expect(page).toHaveURL(/\/ng\/reset-password$/)
  await chooseTheme(page, 'Light')
  await page.getByLabel('New Password', { exact: true }).fill('summer2026x')
  await page.getByLabel('Confirm new password').fill('summer2026x')
  await page.screenshot({
    path: test.info().outputPath('reset-password.png'),
    fullPage: true,
    animations: 'disabled',
  })
  await page.getByRole('button', { name: 'Reset Password', exact: true }).click()
  await expect(page.locator('[data-reset-done]')).toBeVisible()
})

test('two-step authentication keeps its code while switching theme in the shared layout', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('mailbox-all-factors')
  await signInWithPassword(page, 'alice@example.org')
  await expect(
    page.getByRole('heading', { name: 'Two-factor authentication', exact: true }),
  ).toBeVisible()
  await expectAuthLayout(page)
  const code = page.getByLabel('Six-digit code')
  await code.fill('12345')
  await chooseTheme(page, 'Dark')
  await expect(code).toHaveValue('12345')
  await page.screenshot({
    path: test.info().outputPath('two-step-auth.png'),
    fullPage: true,
    animations: 'disabled',
  })
  await code.press('End')
  await code.press('6')
  await expectLanding(page, 'mailboxUser')
})
