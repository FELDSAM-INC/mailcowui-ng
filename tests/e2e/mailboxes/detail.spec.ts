// UI 003 US1 (detail), US3 and US5 on the mailbox page, which mirrors the classic
// `edit/mailbox.twig` (owner rule 1:1): legacy's heading, the usage figures with the list's keys,
// the tabs as sections in legacy order, the "Mailbox" tab's fields and saves, outdated saves, the
// flags of domain administrators, the custom attributes and the ACL.
import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'

const GIB = 1024 ** 3

async function open(page: Page, address = 'anna@a.example') {
  await page.goto(`mailboxes/${address}`)
  await expect(page.getByRole('heading', { level: 1, name: 'Edit mailbox' })).toBeVisible()
}

async function edit(page: Page, section: string) {
  await page.getByRole('button', { name: `Edit ${section}`, exact: true }).click()
  await expect(page.getByRole('heading', { level: 2, name: section })).toBeFocused()
}

async function updates(mockApi: {
  requests(): Promise<{ operationId: string | null; status: number; body?: unknown }[]>
}) {
  return (await mockApi.requests()).filter((request) => request.operationId === 'updateMailbox')
}

const isNarrow = (page: Page) => (page.viewportSize()?.width ?? 0) < 768

test.describe('the mailbox page', () => {
  test('US1-AS9 FR-015 legacy heading, usage figures and the tabs as sections in legacy order', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
    expectTouchTargets,
  }) => {
    await mockApi.use('admin-edit')
    await open(page)
    await expect(page.getByText('anna@a.example', { exact: true })).toBeVisible()
    const usage = page.locator('[data-mailbox-usage]')
    await expect(usage.locator('[data-figure="quota"]')).toContainText('1.5 GiB/2 GiB')
    await expect(usage.locator('[data-figure="inUse"]')).toContainText('75%')
    await expect(usage.locator('[data-figure="messages"]')).toContainText('10,000')
    await expect(usage.locator('[data-login="imap"]')).toContainText('IMAP @')
    await expect(usage.locator('[data-login="sso"]')).toContainText('SSO @ No record')
    // UI 006: the rate limit section is loaded on its own.
    await expect(page.locator('#rate-limit h2')).toBeVisible()
    const headings = await page.locator('section[id^="section-"] h2').allTextContents()
    expect(headings.map((text) => text.trim())).toEqual([
      'Edit mailbox',
      'Custom attributes',
      'Pushover',
      'ACL (Permission)',
      'Rate limit',
      '⚠️ Rename mailbox',
    ])
    const section = page.locator('#section-mailbox')
    await expect(section).toContainText('Sender-dependent transports')
    await expect(section).toContainText('ID 2')
    await expect(section).toContainText('Quota (MiB)')
    await expect(section).toContainText('Created on:')
    // UI 006 makes the rate limit editable in its own section (tests/e2e/rate-limits).
    await expect(page.locator('#rate-limit')).toContainText('Disabled')
    await expect(
      page.locator('header').getByRole('link', { name: 'History', exact: true }),
    ).toBeVisible()
    await expectAccessible()
    await expectNoHorizontalScroll()
    if (isNarrow(page)) await expectTouchTargets()
  })

  test('US1-AS8 FR-004 a domain administrator gets "not found" for another domain, as for a missing mailbox', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('domain-admin-edit')
    await page.goto('mailboxes/eve@b.example')
    await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Back to the mailboxes' })).toBeVisible()
    await page.goto('mailboxes/nobody@a.example')
    await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'History' })).toHaveCount(0)
    await expectAccessible()
  })

  test('IDN: the readable address with its ASCII form, and a differently cased address is replaced', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('admin-edit')
    await page.goto('mailboxes/DORA@xn--bcher-kva.example')
    await expect(page.getByText('dora@bücher.example (dora@xn--bcher-kva.example)')).toBeVisible()
    await expect(page).toHaveURL(/mailboxes\/dora@xn--bcher-kva\.example$/)
  })

  test('US3 FR-031 FR-032 FR-067 the Mailbox section sends only the change and shows legacy’s success', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('admin-edit')
    await open(page)
    await edit(page, 'Edit mailbox')
    await expect(page).toHaveURL(/edit=mailbox/)
    await page.getByRole('textbox', { name: 'Full name', exact: true }).fill('Anna S.')
    await expectAccessible()
    await page
      .locator('section[id^="section-"]')
      .getByRole('button', { name: 'Save changes', exact: true })
      .click()
    await expect(
      page
        .locator('section[id^="section-"]')
        .getByText('Changes to mailbox anna@a.example have been saved'),
    ).toBeVisible()
    const sent = await updates(mockApi)
    expect(sent.at(-1)).toMatchObject({ status: 200, body: { displayName: 'Anna S.' } })
    await expect(page.locator('#section-mailbox')).toContainText('Anna S.')
  })

  test('US3-AS4 the largest quota is shown, a larger one is refused before sending, 0 = ∞', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('admin-edit')
    await open(page)
    await edit(page, 'Edit mailbox')
    const quota = page.getByRole('textbox', { name: 'Quota (MiB)' })
    await expect(quota).toHaveValue('2048')
    await expect(page.locator('#section-mailbox')).toContainText('max. 10,240 MiB')
    await expect(page.locator('#section-mailbox')).toContainText('0 = ∞')
    await quota.fill('20480')
    await page
      .locator('section[id^="section-"]')
      .getByRole('button', { name: 'Save changes', exact: true })
      .click()
    await expect(
      page.getByText('Quota exceeds the domain limit (max. 10240 MiB)').first(),
    ).toBeVisible()
    expect(await updates(mockApi)).toHaveLength(0)
  })

  test('US3-AS3 FR-044 SC-006 a change elsewhere: nothing is overwritten, the change is listed, Save again saves', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('admin-edit')
    await open(page)
    await edit(page, 'Edit mailbox')
    await mockApi.patch({ mailboxes: { set: { 'anna@a.example': { quota: 3 * GIB } } } })
    await page.getByRole('textbox', { name: 'Full name', exact: true }).fill('Anna New')
    await page
      .locator('section[id^="section-"]')
      .getByRole('button', { name: 'Save changes', exact: true })
      .click()
    const notice = page.locator('[data-outdated]')
    await expect(notice).toContainText('Quota (MiB): now saved as 3 GiB')
    await expect(page.getByRole('textbox', { name: 'Full name', exact: true })).toHaveValue(
      'Anna New',
    )
    await expectAccessible()
    await page.getByRole('button', { name: 'Save again' }).click()
    await expect(
      page
        .locator('section[id^="section-"]')
        .getByText('Changes to mailbox anna@a.example have been saved'),
    ).toBeVisible()
    expect((await updates(mockApi)).map((request) => request.status)).toEqual([412, 200])
  })

  test('US3-AS1 FR-028 FR-029 a generated password fills both fields, meets the policy and is saved', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('admin-edit')
    await open(page)
    await edit(page, 'Edit mailbox')
    const section = page.locator('#section-mailbox')
    await expect(section.locator('[data-password-policy]')).toContainText(
      'Minimum password length is 10',
    )
    await expect(section.locator('[data-password-policy]')).toContainText(
      'Must contain at least one number',
    )
    await expect(section.getByLabel('Password', { exact: true })).toHaveAttribute(
      'placeholder',
      'If unchanged leave blank',
    )
    await section.locator('[data-generate]').click()
    const password = await section.getByLabel('Password', { exact: true }).inputValue()
    expect(password.length).toBeGreaterThanOrEqual(16)
    await expect(section.getByLabel('Confirmation password (repeat)')).toHaveValue(password)
    await expect(section.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'text')
    await page
      .locator('section[id^="section-"]')
      .getByRole('button', { name: 'Save changes', exact: true })
      .click()
    await expect(
      page
        .locator('section[id^="section-"]')
        .getByText('Changes to mailbox anna@a.example have been saved'),
    ).toBeVisible()
    const sent = await updates(mockApi)
    expect(sent.at(-1)).toMatchObject({ status: 200, body: { password: '[redacted]' } })
    await edit(page, 'Edit mailbox')
    await expect(section.getByLabel('Password', { exact: true })).toHaveValue('')
  })

  test('the repeat must match the password (danger.password_mismatch) before sending', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('admin-edit')
    await open(page)
    await edit(page, 'Edit mailbox')
    const section = page.locator('#section-mailbox')
    await section.getByLabel('Password', { exact: true }).fill('Secret-pass-1')
    await section.getByLabel('Confirmation password (repeat)').fill('Secret-pass-2')
    await page
      .locator('section[id^="section-"]')
      .getByRole('button', { name: 'Save changes', exact: true })
      .click()
    await expect(section.getByText('Confirmation password does not match').first()).toBeVisible()
    expect(await updates(mockApi)).toHaveLength(0)
  })

  test('the haveibeenpwned check sends only the first five characters of the SHA-1', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('admin-edit')
    const asked: string[] = []
    await page.route('https://api.pwnedpasswords.com/range/*', async (route) => {
      asked.push(route.request().url())
      await route.fulfill({
        status: 200,
        contentType: 'text/plain',
        body: '1E4C9B93F3F0682250B6CF8331B7EE68FD8:3861493',
      })
    })
    await open(page)
    await edit(page, 'Edit mailbox')
    const section = page.locator('#section-mailbox')
    await section.getByLabel('Password', { exact: true }).fill('password')
    await section.getByRole('button', { name: 'Check against haveibeenpwned.com' }).click()
    await expect(
      section.getByText('Matched! This is a potentially dangerous password!'),
    ).toBeVisible()
    expect(asked).toEqual(['https://api.pwnedpasswords.com/range/5BAA6'])
  })

  test('US3-AS6 FR-036 an LDAP mailbox has no password or recovery e-mail; the built-in source shows them', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('admin-edit')
    await open(page, 'dana@a.example')
    await edit(page, 'Edit mailbox')
    const section = page.locator('#section-mailbox')
    await expect(section.getByLabel('Password', { exact: true })).toHaveCount(0)
    await expect(section.getByLabel('Password recovery email')).toHaveCount(0)
    await expect(section.getByLabel('Force password update at next login')).toBeDisabled()
    await section.getByLabel('Identity Provider').selectOption('mailcow')
    await expect(section.getByLabel('Password', { exact: true })).toBeVisible()
    await expect(section.getByLabel('Password recovery email')).toBeVisible()
  })

  test('US3-AS5 FR-041 without the flags, protocols and SOGo access are read-only with "Prohibited by ACL"', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('domain-admin-edit-limited')
    await open(page)
    await edit(page, 'Edit mailbox')
    const section = page.locator('#section-mailbox')
    await expect(section.locator('[data-locked="section-mailbox-protocols"]')).toContainText(
      'Prohibited by ACL',
    )
    await expect(section.locator('[data-locked="section-mailbox-protocols"]')).toContainText(
      'Change protocol access',
    )
    await expect(section.getByLabel('Direct forwarding to SOGo')).toBeDisabled()
    await expect(section).toContainText('Allow management of SOGo access')
    await expect(section).not.toContainText('Sender-dependent transports')
    await expectAccessible()
  })

  test('US3-AS7 FR-033 leaving a section with unsaved changes asks first', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('admin-edit')
    await open(page)
    await edit(page, 'Edit mailbox')
    await page.getByRole('textbox', { name: 'Full name', exact: true }).fill('Changed')
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('alertdialog')).toContainText('Leave without saving?')
    await page.getByRole('button', { name: 'Stay' }).click()
    await expect(page.getByRole('textbox', { name: 'Full name', exact: true })).toHaveValue(
      'Changed',
    )
  })

  test('US5-AS5 FR-039 custom attributes: add department=Sales, remove old; a name with a space is refused', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('admin-edit')
    await open(page)
    await edit(page, 'Custom attributes')
    const section = page.locator('#section-attributes')
    await section.getByRole('button', { name: 'Add row' }).click()
    await section.getByLabel('Attribute 2').fill('bad name')
    await section.getByLabel('Value 2').fill('x')
    await page
      .locator('section[id^="section-"]')
      .getByRole('button', { name: 'Save changes', exact: true })
      .click()
    await expect(section.getByText('Use a name without spaces.').first()).toBeVisible()
    await section.getByLabel('Attribute 2').fill('department')
    await section.getByLabel('Value 2').fill('Sales')
    await section.getByRole('button', { name: 'Remove row 1' }).click()
    await expectAccessible()
    await page
      .locator('section[id^="section-"]')
      .getByRole('button', { name: 'Save changes', exact: true })
      .click()
    await expect(
      page
        .locator('section[id^="section-"]')
        .getByText('Changes to mailbox anna@a.example have been saved'),
    ).toBeVisible()
    expect((await updates(mockApi)).at(-1)?.body).toEqual({
      customAttributes: { department: 'Sales', old: null },
    })
    await expect(section).toContainText('department')
    await expect(section).not.toContainText('old')
  })

  test('US5-AS1 FR-037 the ACL sends only the permission that changed', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('admin-edit')
    await open(page)
    await edit(page, 'ACL (Permission)')
    const select = page.getByLabel('ACL', { exact: true })
    const selected = await select.evaluate((element) =>
      [...(element as HTMLSelectElement).selectedOptions].map((option) => option.value),
    )
    await select.selectOption([...selected, 'syncjobs'])
    await page
      .locator('section[id^="section-"]')
      .getByRole('button', { name: 'Save changes', exact: true })
      .click()
    await expect(
      page
        .locator('section[id^="section-"]')
        .getByText('Changes to mailbox anna@a.example have been saved'),
    ).toBeVisible()
    expect((await updates(mockApi)).at(-1)?.body).toEqual({ userPermissions: { syncjobs: true } })
  })

  test('US5-AS2 FR-042 a domain administrator without sync jobs does not see that permission', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('domain-admin-edit-limited')
    await open(page)
    await edit(page, 'ACL (Permission)')
    const options = await page
      .getByLabel('ACL', { exact: true })
      .locator('option')
      .allTextContents()
    expect(options.map((text) => text.trim())).not.toContain('Sync jobs')
    expect(options.map((text) => text.trim())).toContain('Temporary aliases')
  })
})
