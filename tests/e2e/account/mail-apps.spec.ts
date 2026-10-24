import { expect, test } from '../fixtures/test'
import { submitPassword } from '../fixtures/flows'

test('guide shows ports, encryption, disabled direct access and copied values in both themes', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('account-mailbox-no-pop3')
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: (text: string) => {
          ;(window as unknown as { copied: string }).copied = text
          return Promise.resolve()
        },
      },
    })
  })
  await page.goto('account/mail-apps')
  await expect(page.locator('[data-protocol="imap"]')).toContainText('993')
  await expect(page.locator('[data-protocol="imap"]')).toContainText('STARTTLS')
  await expect(page.locator('[data-protocol="smtp"]')).toContainText('587')
  await expect(page.locator('[data-protocol="pop3"]')).toContainText(
    'Only an app password that allows POP3 works here.',
  )
  await expect(page.locator('[data-protocol="activeSync"]')).toContainText(
    'Microsoft-Server-ActiveSync',
  )
  await expect(page.getByRole('main')).toContainText('you need app passwords to log in to apps')
  await expectAccessible()
  await expectNoHorizontalScroll()
  await page.getByRole('button', { name: 'Copy: IMAP, Host', exact: true }).click()
  await expect(page.getByRole('main').getByRole('status')).toContainText(
    'Text copied to clipboard!',
  )
  expect(await page.evaluate(() => (window as unknown as { copied: string }).copied)).toBe(
    'mail.example.net',
  )
  await page.getByRole('button', { name: 'Copy: IMAP, Username', exact: true }).click()
  expect(await page.evaluate(() => (window as unknown as { copied: string }).copied)).toBe(
    'anna@example.org',
  )
})

test('each profile is downloaded only on request; app password creation remains listed', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('account-mailbox-2fa-on')
  await page.goto('account/mail-apps?variant=email&appPassword=1')
  await expect(page).toHaveURL(/account\/mail-apps$/)
  await expect(page.locator('[data-profile-password="true"] [data-variant="email"]')).toBeFocused()
  expect(await mockApi.countRequests('createOwnAppleProfileWithAppPassword')).toBe(0)
  expect(await mockApi.countRequests('getOwnAppleProfile')).toBe(0)
  const plain = page.locator('[data-profile-password="false"]')
  await plain.locator('summary').click()
  for (const variant of ['email', 'emailAndDav']) {
    const waiting = page.waitForEvent('download')
    await plain.locator(`[data-variant="${variant}"]`).click()
    const download = await waiting
    expect(download.suggestedFilename()).toMatch(/^mailcow[ _]UI\.mobileconfig$/)
    expect(await download.failure()).toBeNull()
  }
  const waiting = page.waitForEvent('download')
  await page.locator('[data-profile-password="true"] [data-variant="email"]').click()
  const download = await waiting
  expect(download.suggestedFilename()).toMatch(/\.mobileconfig$/)
  await download.cancel()
  await expect(page.getByRole('main').getByRole('status')).toContainText(
    'Delete the file after installing it.',
  )
  await expectAccessible()
  await page.goto('account/app-passwords')
  await expect(page.locator('[data-entry="100"]')).toBeVisible()
  expect(await mockApi.countRequests('createOwnAppleProfileWithAppPassword')).toBe(1)
})

test('groupware-disabled has only mail profiles and no DAV or ActiveSync; no flag hides the second row', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('account-groupware-disabled')
  await page.goto('account/mail-apps')
  await expect(page.locator('[data-profile-password]')).toHaveCount(2)
  await expect(page.locator('[data-variant="emailAndDav"]')).toHaveCount(0)
  await expect(page.locator('[data-protocol="caldav"]')).toHaveCount(0)
  await expect(page.locator('[data-protocol="carddav"]')).toHaveCount(0)
  await expect(page.locator('[data-protocol="activeSync"]')).toHaveCount(0)
  await expectAccessible()
  await expectNoHorizontalScroll()
  await mockApi.use('account-mailbox-no-flags')
  await page.goto('account/mail-apps')
  await expect(page.locator('[data-profile-password="false"]')).toBeVisible()
  await expect(page.locator('[data-profile-password="true"]')).toHaveCount(0)
})

test('a withdrawn app-password permission explains the refusal and hides its profile row', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('account-profile-flag-withdrawn')
  await page.goto('account/mail-apps')
  await expect(page.locator('[data-profile-password="true"]')).toBeVisible()
  await mockApi.setFlags('anna@example.org', { appPasswds: false })
  await page.locator('[data-profile-password="true"] [data-variant="email"]').click()
  await expect(page.getByRole('main').getByRole('alert')).toBeVisible()
  await expect(page.locator('[data-profile-password="true"]')).toHaveCount(0)
  await expect(page.locator('[data-profile-password="false"]')).toBeVisible()
  await expectAccessible()
})

test('domain administrators get the legacy no-access reason without requesting mailbox setup data', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('account-domain-admin')
  await page.goto('account/mail-apps')
  await expect(page.getByRole('heading', { name: 'No access', exact: true })).toBeVisible()
  await expect(page.getByRole('main')).toContainText('mailbox')
  expect(await mockApi.countRequests('getOwnClientConfiguration')).toBe(0)
  await expectAccessible()
})

test('a signed-out mail setup deep link returns after sign-in without downloading', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('account-mailbox', {
    accounts: { 'anna@example.org': { secondFactors: [] } },
  })
  await mockApi.patch({ expireSession: true })
  await page.goto('account/mail-apps?variant=email&appPassword=1')
  await expect(page).toHaveURL(/sign-in/)
  await submitPassword(page, 'anna@example.org')
  await expect(page.getByRole('heading', { name: 'Mail app setup', exact: true })).toBeVisible()
  await expect(page).toHaveURL(/account\/mail-apps$/)
  expect(await mockApi.countRequests('getOwnAppleProfile')).toBe(0)
  expect(await mockApi.countRequests('createOwnAppleProfileWithAppPassword')).toBe(0)
})
