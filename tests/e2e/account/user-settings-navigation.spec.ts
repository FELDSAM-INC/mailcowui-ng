import { expect, test } from '../fixtures/test'
import { chooseTheme, openAccountSections, openNavigation, submitPassword } from '../fixtures/flows'

const accountItems = [
  'overview',
  'mailApps',
  'twoFactor',
  'passkeys',
  'recentLogins',
  'mailSettings',
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
  await page.getByRole('button', { name: /^Account menu of / }).click()
  await expect(
    page.getByRole('menuitem', { name: 'Password recovery email', exact: true }),
  ).toHaveCount(0)
  await expect(page.getByRole('menuitem', { name: 'Change password', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
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
  test(`the Create spam alias button opens a separate page in ${path}`, async ({
    page,
    mockApi,
  }) => {
    await mockApi.use(scenario)
    await page.goto(path)
    await expect(page.locator('[data-generate-alias]')).toBeHidden()
    const add = page.locator('main header [data-add-alias]')
    await expect(add).toBeVisible()
    await expect(add).toHaveText('Create spam alias')
    await expect(add.locator('svg')).toHaveCount(0)
    await add.click()
    await expect(page).toHaveURL(/temporary-aliases\/new$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Create spam alias')
    await expect(page.locator('[data-entry]')).toHaveCount(0)
    const form = page.locator('[data-generate-alias]')
    await expect(form).toBeVisible()
    await form.getByLabel('Description', { exact: true }).fill('Shop')
    await form.getByRole('button', { name: 'Create spam alias', exact: true }).click()
    await expect(page).toHaveURL(/temporary-aliases\?q=/)
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
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

test('mailbox spam settings are in Email configuration and Quarantine stays in System', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('account-mailbox')
  await page.goto('account/overview')
  const navigation = await openNavigation(page)
  const email = navigation.locator('[data-nav-group="email"]')
  await expect(
    email.getByRole('heading', { name: 'Email configuration', exact: true }),
  ).toBeVisible()
  await expect(email.locator('[data-nav-item]')).toHaveText([
    'Spam filter',
    'Spam email aliases',
    'Sync jobs',
  ])
  await expect(
    navigation.locator(
      '[data-nav-group="userSettings"] [data-nav-item="account-spamFilter"], [data-nav-group="userSettings"] [data-nav-item="account-temporaryAliases"]',
    ),
  ).toHaveCount(0)
  await expect(
    navigation
      .locator('[data-nav-group="system"]')
      .getByRole('link', { name: 'Quarantine', exact: true }),
  ).toBeVisible()
  await expect(navigation.locator('[data-nav-group="quarantine"]')).toHaveCount(0)
  await email.getByRole('link', { name: 'Spam filter', exact: true }).click()
  await expect(page).toHaveURL(/\/spam-filter$/)
  const next = (await openNavigation(page)).locator('[data-nav-group="email"]')
  await expect(next.locator('[aria-current="page"]')).toHaveText('Spam filter')
  await next.getByRole('link', { name: 'Spam email aliases', exact: true }).click()
  await expect(page).toHaveURL(/\/account\/temporary-aliases$/)
  await expect(
    (await openNavigation(page)).locator('[data-nav-group="email"] [aria-current="page"]'),
  ).toHaveText('Spam email aliases')
})

test('creating spam aliases protects drafts and rejects a denied direct route', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('account-mailbox')
  await page.goto('account/temporary-aliases?permanent=true')
  await page.getByRole('link', { name: 'Create spam alias', exact: true }).click()
  await page.getByLabel('Description', { exact: true }).fill('Draft')
  await page.locator('[data-detail-back]').click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Stay', exact: true }).click()
  await expect(page.getByLabel('Description', { exact: true })).toHaveValue('Draft')
  await page.locator('[data-detail-back]').click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Leave', exact: true }).click()
  await expect(page).toHaveURL(/temporary-aliases\?permanent=true$/)
  await mockApi.use('account-mailbox-no-flags')
  await page.goto('account/temporary-aliases/new')
  await expect(page.getByRole('heading', { name: 'No access', exact: true })).toBeVisible()
  expect(await mockApi.countRequests('listTemporaryAliasDomains')).toBe(0)
  expect(await mockApi.countRequests('createTemporaryAlias')).toBe(0)
})

test('domain administrators see Quarantine under System', async ({ page, mockApi }) => {
  await mockApi.use('account-domain-admin')
  await page.goto('domains')
  const nav = await openNavigation(page)
  await expect(nav.locator('[data-nav-group="quarantine"]')).toHaveCount(0)
  await nav
    .locator('[data-nav-group="system"]')
    .getByRole('link', { name: 'Quarantine', exact: true })
    .click()
  await expect(page).toHaveURL(/\/quarantine$/)
  const current = await openNavigation(page)
  await expect(current.locator('[data-nav-group="system"] [aria-current="page"]')).toHaveText(
    'Quarantine',
  )
})
