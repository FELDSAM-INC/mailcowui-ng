// T117: language and theme (US6-AS1–AS9, FR-038, FR-058–FR-062, FR-088, SC-012 and the edge cases
// of untranslated or disabled languages and restricted sessions).
import type { Browser, Page } from '@playwright/test'

import type { MockApi } from '../fixtures/mock-api'
import { expect, test } from '../fixtures/test'
import { MOCK_PASSWORD, submitPassword } from '../fixtures/flows'

async function openUserMenu(page: Page) {
  await page.getByRole('button', { name: /^(Account menu of|Nabídka účtu|Ponuka účtu) / }).click()
  return page.getByRole('menu')
}

async function chooseInMenu(page: Page, name: string) {
  if (name === 'Dark') {
    await page.getByRole('switch', { name: 'Dark', exact: true }).click()
    return
  }
  await openUserMenu(page)
  if (name === 'Device setting') {
    await page.getByRole('menuitemcheckbox', { name, exact: true }).click()
    return
  }
  await page.locator('[data-language-submenu-trigger]').click()
  await page.getByRole('menuitemradio', { name }).click()
}

const preferenceRequests = async (mockApi: MockApi) =>
  (await mockApi.requests()).filter((r) => r.operationId === 'updatePreferences')

/** A second browser on the same mock scenario: "another device". */
async function otherDevice(browser: Browser, scenarioId: string, locale = 'en-GB') {
  const baseURL = test.info().project.use.baseURL ?? 'http://localhost:4173/ng/'
  const context = await browser.newContext({ locale, baseURL })
  await context.addCookies([
    { name: 'mock-scenario', value: scenarioId, domain: new URL(baseURL).hostname, path: '/' },
  ])
  return context
}

test('US6-AS1 FR-059 FR-088 Czech applies at once to text, numbers and the document language, is saved and follows to another device', async ({
  page,
  browser,
  mockApi,
  expectAccessible,
}) => {
  const id = await mockApi.use('admin-active')
  await page.goto('')
  await expect(page.getByRole('heading', { level: 1, name: 'System & Containers' })).toBeVisible()
  await chooseInMenu(page, 'Čeština')
  await expect(page.getByRole('heading', { level: 1, name: 'Systém a kontejnery' })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'cs-CZ')
  const [save] = await preferenceRequests(mockApi)
  expect(save?.body).toEqual({ language: 'cs-cz' })
  expect(save?.headers['if-match']).toBe('"pref-1"')
  await expectAccessible()

  await mockApi.patch({ expireSession: true })
  const device = await otherDevice(browser, id)
  const other = await device.newPage()
  await other.goto('sign-in')
  await expect(other.getByRole('heading', { level: 1, name: 'Login' })).toBeVisible()
  await submitPassword(other, 'admin')
  await expect(other.getByRole('heading', { level: 1, name: 'Systém a kontejnery' })).toBeVisible()
  await device.close()
})

test('SC-012 a language change applies in under one second, measured in the page', async ({
  page,
}) => {
  await page.goto('sign-in')
  await expect(page.getByRole('heading', { level: 1, name: 'Login' })).toBeVisible()
  await page.evaluate(() => {
    const timing = new Promise<number>((resolve) => {
      let start = 0
      document.addEventListener('change', () => (start = performance.now()), {
        capture: true,
        once: true,
      })
      const observer = new MutationObserver(() => {
        if (start && document.querySelector('main h1')?.textContent?.includes('Přihlásit')) {
          observer.disconnect()
          resolve(performance.now() - start)
        }
      })
      observer.observe(document.body, { subtree: true, childList: true, characterData: true })
    })
    ;(window as unknown as { __switch: Promise<number> }).__switch = timing
  })
  await page.getByLabel('Language').selectOption({ label: 'Čeština (Czech)' })
  await expect(page.getByRole('heading', { level: 1, name: 'Přihlásit' })).toBeVisible()
  const elapsed = await page.evaluate(
    () => (window as unknown as { __switch: Promise<number> }).__switch,
  )
  expect(elapsed, 'SC-012: under 1 s').toBeLessThan(1000)
})

test('US6-AS2 FR-059 the dark theme applies at once with the dark logo and is saved', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('admin-active')
  await page.goto('')
  await expect(page.locator('img:visible[src*="logos/light"]')).toBeVisible()
  await chooseInMenu(page, 'Dark')
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect(page.locator('img:visible[src*="logos/dark"]')).toBeVisible()
  await expect
    .poll(async () => (await preferenceRequests(mockApi)).map((r) => r.body))
    .toEqual([{ theme: 'dark' }])
})

test('US6-AS3 FR-062 the device setting follows the device without a reload', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('admin-active', {
    accounts: { admin: { preferences: { language: 'en-gb', theme: 'light', etag: '"p-l"' } } },
  })
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('')
  await expect(page.getByRole('heading', { level: 1, name: 'System & Containers' })).toBeVisible()
  await expect(page.locator('html')).not.toHaveClass(/dark/)
  await chooseInMenu(page, 'Dark')
  await expect(page.locator('html')).toHaveClass(/dark/)
  await chooseInMenu(page, 'Device setting')
  await expect(page.locator('html')).not.toHaveClass(/dark/)
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.emulateMedia({ colorScheme: 'light' })
  await expect(page.locator('html')).not.toHaveClass(/dark/)
})

test.describe('a Slovak browser', () => {
  test.use({ locale: 'sk-SK' })

  test('US6-AS4 FR-061 a signed-out visitor sees the sign-in screen in Slovak', async ({
    page,
    expectAccessible,
  }) => {
    await page.goto('sign-in')
    await expect(page.getByRole('heading', { level: 1, name: 'Prihlásenie' })).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'sk-SK')
    await expectAccessible()
  })
})

test.describe('a French browser', () => {
  test.use({ locale: 'fr-FR' })

  test('US6-AS5 FR-061 an unsupported browser language uses the server default, else English', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('default-language-sk')
    await page.goto('sign-in')
    await expect(page.getByRole('heading', { level: 1, name: 'Prihlásenie' })).toBeVisible()
    await mockApi.use('anonymous-default')
    await page.evaluate(() => localStorage.clear())
    await page.goto('sign-in')
    await expect(page.getByRole('heading', { level: 1, name: 'Login' })).toBeVisible()
  })
})

test('US6-AS6 FR-059 a failed save restores the previous setting with a message', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('preferences-save-fails')
  await page.goto('')
  await chooseInMenu(page, 'Čeština')
  await expect(page.getByRole('alert')).toContainText('Your change was not saved.')
  await expect(page.getByRole('heading', { level: 1, name: 'System & Containers' })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en-GB')
  await expectAccessible()
})

test('US6-AS6 Edge: a preference changed elsewhere applies the saved value and says so', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('admin-active')
  await page.goto('')
  await expect(page.getByRole('heading', { level: 1, name: 'System & Containers' })).toBeVisible()
  await mockApi.patch({
    accounts: {
      admin: { preferences: { language: 'sk-sk', theme: 'system', etag: '"pref-else"' } },
    },
  })
  await chooseInMenu(page, 'Čeština')
  await expect(page.getByRole('heading', { level: 1, name: 'Systém & Kontajnery' })).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('zmenené inde')
})

test('US6-AS7 FR-060 with one language there is no language choice', async ({ page, mockApi }) => {
  await mockApi.use('languages-single')
  await page.goto('sign-in')
  await expect(page.getByLabel('Language')).toHaveCount(0)
  await expect(page.getByLabel('Theme')).toBeVisible()
  await submitPassword(page, 'admin')
  const menu = await openUserMenu(page)
  await expect(menu.getByRole('menuitemradio', { name: 'English' })).toHaveCount(0)
  await expect(menu.getByRole('group', { name: 'Language', exact: true })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('switch', { name: 'Dark', exact: true })).toBeVisible()
})

test('US6-AS8 FR-061 a language chosen on the sign-in screen wins and is saved; without a choice the profile applies', async ({
  page,
  browser,
  mockApi,
}) => {
  await mockApi.use('admin-password')
  await page.goto('sign-in')
  await page.getByLabel('Language').selectOption({ label: 'Slovenčina (Slovak)' })
  await expect(page.getByRole('heading', { level: 1, name: 'Prihlásenie' })).toBeVisible()
  await page.locator('input[name="username"]').fill('admin')
  await page.locator('input[name="password"]').fill(MOCK_PASSWORD)
  await page.getByRole('button', { name: 'Prihlásenie', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Systém & Kontajnery' })).toBeVisible()
  await expect
    .poll(async () => (await preferenceRequests(mockApi)).map((r) => r.body))
    .toEqual([{ language: 'sk-sk' }])

  const scenario = await mockApi.use('profile-cs-dark')
  const device = await otherDevice(browser, scenario)
  const other = await device.newPage()
  await other.goto('sign-in')
  await expect(other.getByRole('heading', { level: 1, name: 'Login' })).toBeVisible()
  await submitPassword(other, 'admin')
  await expect(other.getByRole('heading', { level: 1, name: 'Systém a kontejnery' })).toBeVisible()
  await expect(other.locator('html')).toHaveClass(/dark/)
  expect((await mockApi.requests()).filter((r) => r.operationId === 'updatePreferences')).toEqual(
    [],
  )
  await device.close()
})

test('US6-AS9 FR-061 the language used is remembered on the device after sign-out', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('admin-active')
  await page.goto('')
  await chooseInMenu(page, 'Čeština')
  await expect(page.getByRole('heading', { level: 1, name: 'Systém a kontejnery' })).toBeVisible()
  await page.getByRole('button', { name: /^Nabídka účtu/ }).click()
  await page.getByRole('menuitem', { name: 'Odhlásit se' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Přihlásit' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Přihlásit' })).toBeVisible()
})

test('Edge: no translated server language gives English, no choice and no saved language, while the theme is saved', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('languages-none-translated', { signedInAs: 'admin' })
  await page.goto('')
  await expect(page.getByRole('heading', { level: 1, name: 'System & Containers' })).toBeVisible()
  const menu = await openUserMenu(page)
  await expect(menu.getByRole('menuitemradio', { name: 'English' })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await page.getByRole('switch', { name: 'Dark', exact: true }).click()
  await expect
    .poll(async () => (await preferenceRequests(mockApi)).map((r) => r.body))
    .toEqual([{ theme: 'dark' }])
})

test('Edge: a profile language no longer enabled uses the server default', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('profile-language-disabled')
  await page.goto('sign-in')
  await submitPassword(page, 'admin')
  await expect(page.getByRole('heading', { level: 1, name: 'Systém a kontejnery' })).toBeVisible()
})

test('FR-038 Edge: on the pending-actions screen language and theme apply on this device only', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('forced-password-change')
  await page.goto('')
  await expect(page.getByRole('heading', { level: 1, name: 'Actions required' })).toBeVisible()
  await page.getByLabel('Language').selectOption({ label: 'Čeština (Czech)' })
  await expect(page.locator('html')).toHaveAttribute('lang', 'cs-CZ')
  await page.getByLabel('Motiv').selectOption({ label: 'Tmavý' })
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expectAccessible()
  expect(await preferenceRequests(mockApi)).toEqual([])
})
