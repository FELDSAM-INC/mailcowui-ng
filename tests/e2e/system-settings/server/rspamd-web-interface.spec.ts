import type { Page } from '@playwright/test'
import { expect, test } from '../../fixtures/test'

async function fill(page: Page, value: string, repeat = value) {
  await page.getByLabel('Password', { exact: true }).fill(value)
  await page.getByLabel('Confirmation password (repeat)', { exact: true }).fill(repeat)
}
async function checkSecretSurfaces(page: Page, value: string, messages: string[]) {
  const surfaces = await page.evaluate(() => ({
    local: { ...localStorage },
    session: { ...sessionStorage },
    state: history.state,
    url: location.href,
    title: document.title,
    text: document.body.innerText,
  }))
  expect(JSON.stringify([surfaces, messages])).not.toContain(value)
}

test('US11-AS1 FR-073/106 Rspamd password is write-only and passes quotes and spaces unchanged', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
  expectTouchTargets,
}) => {
  const messages: string[] = []
  page.on('console', (message) => messages.push(message.text()))
  page.on('pageerror', (error) => messages.push(error.message))
  await mockApi.use('settings-admin-defaults', {
    settings: { capabilities: { rspamdWebInterfaceUrl: '/custom-rspamd/' } },
  })
  await page.goto('system')
  await page
    .locator('[data-settings-overview]')
    .getByRole('link', { name: /Rspamd UI/ })
    .click()
  await expect(
    page.locator('[data-section-navigation] a[href="/ng/system/rspamd-web-interface"]'),
  ).toHaveAttribute('aria-current', 'page')
  const password = page.getByLabel('Password', { exact: true })
  await expect(password).toHaveValue('')
  await expect(password).toHaveAttribute('autocomplete', 'new-password')
  await expect(page.locator('[data-rspamd-link]')).toHaveAttribute('href', '/custom-rspamd/')
  await expectAccessible()
  await expectNoHorizontalScroll()
  await expectTouchTargets()
  const secret = '  "Rspamd pass"  '
  await fill(page, secret)
  await page.getByRole('button', { name: 'Toggle password visibility', exact: true }).click()
  await expect(password).toHaveAttribute('type', 'text')
  await page.getByRole('button', { name: 'Toggle password visibility', exact: true }).click()
  const request = page.waitForRequest(
    (request) =>
      request.method() === 'PUT' && request.url().endsWith('/settings/rspamd-ui-password'),
  )
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  // Chromium does not expose this fetch(Request) body (see routing/credential-secrecy).
  // WebKit and the component/API tests verify its exact text; every engine checks the redacted
  // contract-validated write below, without putting the secret into the mock request log.
  const body = (await request).postDataJSON()
  if (body !== null) expect(body).toEqual({ password: secret })
  await expect(page.locator('[data-rspamd-success]')).toContainText(
    'Rspamd UI password successfully set',
  )
  await expect(page.locator('[data-rspamd-success]')).toContainText('Rspamd restarted')
  const writes = (await mockApi.requests()).filter(
    (entry) => entry.operationId === 'setRspamdUiPassword',
  )
  expect(writes).toHaveLength(1)
  expect(writes[0]!.body).toEqual({ password: '[redacted]' })
  await expect(password).toHaveValue('')
  await expect(page.getByLabel('Confirmation password (repeat)')).toHaveValue('')
  await checkSecretSurfaces(page, secret, messages)
  await expectAccessible()
  await page.reload()
  await expect(password).toHaveValue('')
  await checkSecretSurfaces(page, secret, messages)
})

test('US11-AS2 legacy minimum length and confirmation are checked before sending', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('settings-admin-defaults')
  await page.goto('system/rspamd-web-interface')
  await fill(page, 'short')
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(
    page.getByText('Rspamd UI password should be at least 6 chars long', { exact: false }),
  ).toBeVisible()
  await expect(page.getByLabel('Password', { exact: true })).toBeFocused()
  await expectAccessible()
  await fill(page, 'Long-password', 'Mismatch')
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(
    page.getByText('Confirmation password does not match', { exact: false }),
  ).toBeVisible()
  expect(await mockApi.countRequests('setRspamdUiPassword')).toBe(0)
})

for (const [scenario, message] of [
  ['rspamd-ui-service-fails', 'The change could not be confirmed'],
  ['rspamd-ui-outcome-unknown', 'It is unknown whether the password was set'],
]) {
  test(`FR-074/106 ${scenario} clears the secret and offers an explicit retry`, async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
  }) => {
    await mockApi.use(scenario!)
    await page.goto('system/rspamd-web-interface')
    const secret = 'Failure-only-secret'
    await fill(page, secret)
    await page.getByRole('button', { name: 'Save changes', exact: true }).click()
    await expect(page.locator('[data-rspamd-outcome]')).toContainText(message!)
    await expect(page.getByLabel('Password', { exact: true })).toHaveValue('')
    await expect(page.getByLabel('Confirmation password (repeat)')).toHaveValue('')
    await checkSecretSurfaces(page, secret, [])
    await expectAccessible()
    await expectNoHorizontalScroll()
    await page.getByRole('button', { name: 'Try again', exact: true }).click()
    await expect(page.getByLabel('Password', { exact: true })).toBeFocused()
    expect(await mockApi.countRequests('setRspamdUiPassword')).toBe(1)
    await mockApi.patch({ failures: { setRspamdUiPassword: { status: 502, times: 0 } } })
    await fill(page, 'New-retry-secret')
    await page.getByRole('button', { name: 'Save changes', exact: true }).click()
    await expect(page.locator('[data-rspamd-success]')).toBeVisible()
  })
}

test('FR-106 network failure clears both password fields without saving a draft', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('settings-admin-defaults')
  await page.goto('system/rspamd-web-interface')
  await page.route('**/api/v2/settings/rspamd-ui-password', (route) => route.abort())
  const secret = 'Network-only-secret'
  await fill(page, secret)
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('')
  await expect(page.getByLabel('Confirmation password (repeat)')).toHaveValue('')
  await checkSecretSurfaces(page, secret, [])
})

test('FR-013/014 pending writes disable submitting and leaving keeps the dirty-form guard', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('settings-admin-defaults')
  await page.goto('system/rspamd-web-interface')
  await fill(page, 'Unsaved-password')
  await page.getByRole('main').getByRole('link', { name: 'System settings', exact: true }).click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Stay', exact: true }).click()
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('Unsaved-password')
  await mockApi.delay('setRspamdUiPassword', 700)
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Save changes', exact: true })).toBeDisabled()
  await expect(page.getByLabel('Password', { exact: true })).toBeDisabled()
  await expect(page.locator('[data-rspamd-success]')).toBeVisible()
  expect(await mockApi.countRequests('setRspamdUiPassword')).toBe(1)
})

for (const scenario of ['settings-domain-admin', 'settings-mailbox-user']) {
  test(`FR-001 ${scenario} cannot enter Rspamd settings or request its capabilities`, async ({
    page,
    mockApi,
  }) => {
    await mockApi.use(scenario)
    await page.goto('system/rspamd-web-interface')
    await expect(page.getByRole('heading', { name: 'No access', exact: true })).toBeVisible()
    expect(await mockApi.countRequests('getSettingsCapabilities')).toBe(0)
    expect(await mockApi.countRequests('setRspamdUiPassword')).toBe(0)
  })
}

test('Rspamd settings remain available in demo mode, which only restricts branding settings', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('settings-demo-mode')
  await page.goto('system/rspamd-web-interface')
  await fill(page, 'Demo-password')
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.locator('[data-rspamd-success]')).toBeVisible()
})
