import { expect, test } from '../fixtures/test'
import { chooseTheme, openAccountSections, submitPassword } from '../fixtures/flows'

const accountItems = [
  'overview',
  'mailApps',
  'activeScript',
  'password',
  'recoveryEmail',
  'twoFactor',
  'passkeys',
  'recentLogins',
  'mailSettings',
  'temporaryAliases',
  'appPasswords',
  'pushNotifications',
]

test('mailbox sign-in opens only Overview and sidebar links replace account tabs', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('account-mailbox', { accounts: { 'anna@example.org': { secondFactors: [] } } })
  await mockApi.patch({ expireSession: true })
  await page.goto('sign-in')
  await submitPassword(page, 'anna@example.org')
  await expect(page).toHaveURL(/\/account\/overview$/)
  await expect(page.locator('[data-mailbox-overview]')).toBeVisible()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Overview')
  await expect(page.locator('[data-profile-password], [data-section-nav]')).toHaveCount(0)
  expect(await mockApi.countRequests('getOwnClientConfiguration')).toBe(0)
  const nav = await openAccountSections(page)
  await expect(nav.locator('[data-nav-item]')).toHaveCount(accountItems.length)
  for (const item of accountItems)
    await expect(nav.locator(`[data-nav-item="account-${item}"]`)).toBeVisible()
  await expect(nav.locator('[aria-current="page"]')).toHaveText('Overview')
  await nav.getByRole('link', { name: 'Mail app setup', exact: true }).click()
  await expect(page).toHaveURL(/\/account\/mail-apps$/)
  await expect(page.locator('[data-mailbox-overview], [data-section-nav]')).toHaveCount(0)
  await expect(page.locator('[data-protocol="imap"]')).toBeVisible()
  const next = await openAccountSections(page)
  await expect(next.locator('[aria-current="page"]')).toHaveText('Mail app setup')
})

test('Apple profiles default to an app password and keep normal-password profiles under Advanced settings', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('account-mailbox', {
    publicConfig: {
      brandColors: {
        light: { color: '#febc23', foreground: '#000000' },
        dark: { color: '#febc23', foreground: '#000000' },
      },
    },
  })
  await page.goto('account/mail-apps')
  const primary = page.locator('[data-profile-password="true"] [data-variant="email"]')
  const plain = page.locator('[data-profile-password="false"] [data-variant="email"]')
  await expect(primary).toBeVisible()
  await expect(plain).toBeHidden()
  await expect(primary).toHaveCSS('background-color', 'rgb(254, 188, 35)')
  expect(await mockApi.countRequests('createOwnAppleProfileWithAppPassword')).toBe(0)
  const download = page.waitForEvent('download')
  await primary.click()
  expect((await download).suggestedFilename()).toMatch(/\.mobileconfig$/)
  await expect(
    page.getByRole('status').filter({ hasText: 'Delete the file after installing it.' }),
  ).toBeVisible()
  expect(await mockApi.countRequests('createOwnAppleProfileWithAppPassword')).toBe(1)
  await page.locator('[data-profile-password="false"] summary').click()
  await expect(plain).toBeVisible()
  const normalDownload = page.waitForEvent('download')
  await plain.click()
  await normalDownload
  expect(await mockApi.countRequests('getOwnAppleProfile')).toBe(1)
  await page.goto('account/app-passwords')
  await expect(page.locator('[data-entry="100"]')).toBeVisible()
})

test('sidebar respects account flags and normal profiles remain available without app-password permission', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('account-mailbox-no-flags')
  await page.goto('account')
  await expect(page).toHaveURL(/\/account\/overview$/)
  const nav = await openAccountSections(page)
  for (const item of [
    'recoveryEmail',
    'mailSettings',
    'temporaryAliases',
    'appPasswords',
    'pushNotifications',
  ])
    await expect(nav.locator(`[data-nav-item="account-${item}"]`)).toHaveCount(0)
  await nav.getByRole('link', { name: 'Mail app setup', exact: true }).click()
  await expect(page.locator('[data-profile-password="true"]')).toHaveCount(0)
  await expect(page.locator('[data-profile-password="false"] [data-variant="email"]')).toBeVisible()
  await page.goto('account/app-passwords')
  await expect(page.getByRole('heading', { name: 'No access', exact: true })).toBeVisible()
  expect(await mockApi.countRequests('listAppPasswords')).toBe(0)
})

test('sidebar navigation preserves unsaved passwords and account action links have transparent backgrounds', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('account-mailbox')
  await page.goto('account/password')
  for (const theme of ['Light', 'Dark']) {
    await chooseTheme(page, theme)
    for (const control of [
      page.locator('[data-generate]'),
      page.getByRole('button', { name: /check.*haveibeenpwned/i }),
    ])
      await expect(control).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  }
  await page.getByLabel('New password', { exact: true }).fill('Unsaved-password-7')
  let nav = await openAccountSections(page)
  await nav.getByRole('link', { name: 'App passwords', exact: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Stay', exact: true }).click()
  await expect(page.getByLabel('New password', { exact: true })).toHaveValue('Unsaved-password-7')
  nav = await openAccountSections(page)
  await nav.getByRole('link', { name: 'Two-factor authentication', exact: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Leave', exact: true }).click()
  await expect(
    page.getByRole('main').getByRole('link', { name: 'Passkeys', exact: true }),
  ).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
})

for (const [scenario, path] of [
  ['temporary-aliases-empty', 'account/temporary-aliases'],
  ['account-admin', 'mailboxes/anna@example.org/temporary-aliases'],
] as const) {
  test(`the header Add button opens alias generation in ${path}`, async ({ page, mockApi }) => {
    await mockApi.use(scenario)
    await page.goto(path)
    await expect(page.locator('[data-generate-alias]')).toBeHidden()
    const add = page.locator('main header [data-add-alias]')
    await expect(add).toBeVisible()
    await expect(add).toHaveText('Add')
    await add.click()
    const form = page.locator('[data-generate-alias]')
    await expect(form).toBeVisible()
    await form.getByLabel('Description', { exact: true }).fill('Shop')
    await form.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(form.locator('[data-new-alias]')).toBeVisible()
    await expect(page.locator('[data-entry]').filter({ hasText: 'Shop' })).toBeVisible()
  })
}

test('administrator account entry still opens Password with account tabs', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('account-admin')
  await page.goto('account')
  await expect(page).toHaveURL(/\/account\/password$/)
  await expect(page.locator('[data-section-nav]')).toBeVisible()
  await expect(page.locator('[data-nav-group="userSettings"]')).toHaveCount(0)
})
