// T148: mounted-form 412 preservation is covered by recovery-email/app-passwords/push-notifications;
// filter and push dirty guards by their feature specs. R13 forbids drafts after unmount/auth loss.
import type { Page } from '@playwright/test'

import { MOCK_PASSWORD, politeRegion, submitPassword } from '../fixtures/flows'
import { expect, test } from '../fixtures/test'

const reads = [
  { path: 'account', api: '/me/mailbox', ready: '[data-mailbox-address]' },
  { path: 'account/password', api: '/me/password-policy', ready: '[data-password-policy]' },
  { path: 'pending-actions', api: '/me/password-policy', ready: '[data-password-policy]' },
  { path: 'account/recovery-email', api: '/me/recovery-email', ready: '[data-recovery-email]' },
  { path: 'account/two-factor', api: '/me/second-factors', ready: '[data-second-factors]' },
  {
    path: 'account/two-factor/add/totp',
    api: '/me/second-factors/totp-enrolment',
    ready: '[data-grouped-secret]',
  },
  {
    path: 'account/app-passwords',
    api: '/mailboxes/*/app-passwords',
    ready: '[data-app-password-list]',
  },
  {
    path: 'account/app-passwords/1',
    api: '/mailboxes/*/app-passwords/1',
    ready: '[data-app-password-form]',
  },
  {
    path: 'account/temporary-aliases',
    api: '/mailboxes/*/temporary-aliases',
    ready: '[data-temporary-alias-list], main p[role="status"]:not([aria-busy="true"])',
  },
  {
    path: 'account/mail-settings',
    api: '/mailboxes/*/mail-settings',
    ready: 'button[data-value="subfolder"]',
  },
  {
    path: 'account/push-notifications',
    api: '/mailboxes/*/push-notifications',
    ready: '[data-push-form]',
  },
  {
    path: 'account/recent-logins',
    api: '/mailboxes/*/recent-logins',
    ready: '[data-recent-logins]',
  },
  {
    path: 'account/mail-apps',
    api: '/me/mailbox/client-configuration',
    ready: '[data-protocol="imap"]',
  },
  { path: 'account/filters', api: '/mailboxes/*/active-sieve-script', ready: 'pre' },
] as const

for (const { path, api, ready } of reads) {
  test(`FR-010 ${path} exposes busy status and recovers from an offline read`, async ({
    page,
    mockApi,
  }) => {
    await mockApi.use(
      path === 'account/filters'
        ? 'account-active-script'
        : path === 'pending-actions'
          ? 'account-forced-password-policy'
          : 'account-mailbox',
    )
    const url = `**/api/v2${api}{,?*}`
    // Hold the first data request until its own busy state has rendered, then simulate offline.
    let release!: () => void
    let requested!: () => void
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    const received = new Promise<void>((resolve) => {
      requested = resolve
    })
    await page.route(url, async (route) => {
      requested()
      await held
      await route.abort()
    })
    try {
      await page.goto(path)
      await received
      await expect(
        page.getByRole('main').locator('[role="status"][aria-busy="true"]').first(),
      ).toBeVisible()
      release()
      const retry = page
        .getByRole('main')
        .getByRole('button', { name: 'Try again', exact: true })
        .first()
      await expect(retry).toBeVisible()
      await page.unroute(url)
      await retry.click()
      await expect(page.locator(ready)).toBeVisible()
      await expect(retry).toHaveCount(0)
    } finally {
      release()
    }
  })
}

test('a pending action returned by a secret request clears the open form and opens forced setup', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('account-mailbox')
  await page.goto('account/recovery-email')
  await page.getByLabel('Email', { exact: true }).fill('pending@example.net')
  await page.getByLabel('Current password (confirm changes)').fill(MOCK_PASSWORD)
  await mockApi.patch({
    accounts: { 'anna@example.org': { pendingActions: ['passwordChange'] } },
  })
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page).toHaveURL(/\/pending-actions\?returnTo=/)
  await expect(page.locator('[data-recovery-email]')).toHaveCount(0)
  await expect(page.locator('[data-forced-password]')).toBeVisible()
})

test('R13 an expired recovery form discards secrets and reloads saved values after reauthentication', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('account-mailbox', {
    accounts: { 'anna@example.org': { secondFactors: [] } },
  })
  await page.goto('account/recovery-email')
  await page.getByLabel('Email', { exact: true }).fill('unsaved@example.net')
  await page.getByLabel('Current password (confirm changes)').fill(MOCK_PASSWORD)
  await mockApi.patch({ expireSession: true })
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Login' })).toBeVisible()
  await expect(page.locator('[data-recovery-email]')).toHaveCount(0)
  await expect(page.getByRole('alertdialog', { name: 'Leave without saving?' })).toHaveCount(0)
  await submitPassword(page, 'anna@example.org')
  await expect(page).toHaveURL(/\/account\/recovery-email$/)
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue('anna.private@example.net')
  await expect(page.getByLabel('Current password (confirm changes)')).toHaveValue('')
})

test('FR-011 recovery success is polite and keeps keyboard focus on the submit control', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('account-mailbox')
  await page.goto('account/recovery-email')
  await page.getByLabel('Email', { exact: true }).fill('saved@example.net')
  await page.getByLabel('Current password (confirm changes)').fill(MOCK_PASSWORD)
  const submit = page.getByRole('button', { name: 'Save changes' })
  await submit.focus()
  await submit.press('Enter')
  await expect(politeRegion(page)).toContainText(
    'Changes to mailbox anna@example.org have been saved',
  )
  await expect(submit).toBeFocused()
  await expect(page.getByLabel('Current password (confirm changes)')).toHaveValue('')
})

const drafts: {
  path: string
  section: string
  parent: string
  fill: (page: Page) => Promise<void>
}[] = [
  {
    path: 'recovery-email',
    section: 'recoveryEmail',
    parent: 'account',
    fill: (page) => page.getByLabel('Email', { exact: true }).fill('draft@example.net'),
  },
  {
    path: 'two-factor/add/totp',
    section: 'twoFactor',
    parent: 'account/two-factor',
    fill: (page) => page.getByLabel('An identifier for your key').fill('Draft app'),
  },
  {
    path: 'app-passwords/new',
    section: 'appPasswords',
    parent: 'account/app-passwords',
    fill: (page) => page.getByLabel('App name', { exact: true }).fill('Draft app'),
  },
  {
    path: 'temporary-aliases',
    section: 'temporaryAliases',
    parent: 'account',
    fill: (page) =>
      (async () => {
        await page.getByText('Generate random alias', { exact: true }).click()
        await page
          .locator('[data-generate-alias]')
          .getByLabel('Description', { exact: true })
          .fill('Draft alias')
      })(),
  },
]
for (const { path, section, parent, fill } of drafts) {
  test(`FR-015 ${path} asks before abandoning changed input`, async ({ page, mockApi }) => {
    await mockApi.use('account-mailbox')
    await page.goto('account')
    await page.locator(`[data-sections] [data-section="${section}"]`).click()
    if (parent !== 'account') await page.locator(`a[href$="/account/${path}"]`).click()
    await fill(page)
    await page.goBack()
    const dialog = page.getByRole('alertdialog', { name: 'Leave without saving?' })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Stay', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/account/${path}$`))
    await page.goBack()
    await dialog.getByRole('button', { name: 'Leave', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/${parent}$`))
  })
}
