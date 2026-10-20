import { expect, test } from '../../fixtures/test'
import { signOutFromMenu } from '../../fixtures/flows'

test('T054 a forbidden save keeps the input and refreshes identity', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('ui-texts-custom')
  await page.goto('system/customize/ui-texts')
  const section = page.locator('#section-names')
  await section.getByRole('button', { name: /^Edit / }).click()
  await page.locator('#ui-text-productName').fill('Retained input')
  const before = (await mockApi.requests()).filter(
    (request) => request.operationId === 'getIdentity',
  ).length
  await mockApi.failNext('updateUiTexts', { status: 403, type: 'forbidden' })
  await section.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(section.locator('[role=alert]')).toBeVisible()
  await expect(page.locator('#ui-text-productName')).toHaveValue('Retained input')
  await expect
    .poll(
      async () =>
        (await mockApi.requests()).filter((request) => request.operationId === 'getIdentity')
          .length,
    )
    .toBeGreaterThan(before)
  await expectAccessible()
})

test('T054 stale changes require an explicit retry with the fresh version', async ({
  page,
  context,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('ui-texts-custom')
  await page.goto('system/customize/ui-texts')
  const section = page.locator('#section-names')
  await section.getByRole('button', { name: /^Edit / }).click()
  await page.locator('#ui-text-productName').fill('My draft')
  const other = await context.newPage()
  await other.goto('system/customize/ui-texts')
  await other
    .locator('#section-names')
    .getByRole('button', { name: /^Edit / })
    .click()
  await other.locator('#ui-text-productName').fill('Saved elsewhere')
  await other
    .locator('#section-names')
    .getByRole('button', { name: 'Save changes', exact: true })
    .click()
  await expect(other.locator('#section-names form')).toHaveCount(0)
  await other.close()
  await section.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(section.locator('[data-outdated]')).toContainText('Saved elsewhere')
  await expect(page.locator('#ui-text-productName')).toHaveValue('My draft')
  await expectAccessible()
  await section.getByRole('button', { name: 'Save again', exact: true }).click()
  await expect(section.locator('form')).toHaveCount(0)
  await expect(section).toContainText('My draft')
})

test('T054 retains text on a temporary failure and submits only once while saving', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('ui-texts-custom')
  await page.goto('system/customize/ui-texts')
  const section = page.locator('#section-footer')
  await section.getByRole('button', { name: /^Edit / }).click()
  await section.locator('textarea').fill('<p>Footer draft</p>')
  await mockApi.failNext('updateUiTexts', { status: 503 })
  await section.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(section.locator('[role=alert]')).toBeVisible()
  await expect(section.locator('textarea')).toHaveValue('<p>Footer draft</p>')
  await expectAccessible()
  await mockApi.delay('updateUiTexts', 700)
  await section.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(section.getByRole('button', { name: 'Saving…', exact: true })).toBeDisabled()
  await expect(section.locator('form')).toHaveCount(0)
  expect(await mockApi.countRequests('updateUiTexts')).toBe(2)
})

test('T054 rejects pasted controls and the HTML limit, preserving both inputs', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('ui-texts-custom')
  await page.goto('system/customize/ui-texts')
  const names = page.locator('#section-names')
  await names.getByRole('button', { name: /^Edit / }).click()
  await page.locator('#ui-text-productName').evaluate((input) => {
    const clipboardData = new DataTransfer()
    clipboardData.setData('text', 'One\nTwo')
    input.dispatchEvent(
      new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData }),
    )
  })
  await expect(page.locator('#ui-text-productName')).toHaveAttribute('aria-invalid', 'true')
  await names.getByRole('button', { name: 'Save changes', exact: true }).click()
  expect(await mockApi.countRequests('updateUiTexts')).toBe(0)
  await names.getByRole('button', { name: 'Cancel', exact: true }).click()
  const help = page.locator('#section-login-help')
  await help.getByRole('button', { name: /^Edit / }).click()
  await help.locator('textarea').fill('x'.repeat(65536))
  await expectNoHorizontalScroll()
  await help.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(help.locator('textarea')).toHaveAttribute('aria-invalid', 'true')
  expect(await mockApi.countRequests('updateUiTexts')).toBe(0)
  await help.locator('textarea').fill('<p>Safe help</p>')
  await help.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(help.locator('form')).toHaveCount(0)
  await expectAccessible()
})

test('T054 demo enabled during editing keeps the draft and turns controls read-only', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('ui-texts-custom')
  await page.goto('system/customize/ui-texts')
  const section = page.locator('#section-names')
  await section.getByRole('button', { name: /^Edit / }).click()
  await page.locator('#ui-text-productName').fill('Kept draft')
  await mockApi.patch({ settings: { capabilities: { demoMode: true } } })
  await section.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.locator('#ui-text-productName')).toBeDisabled()
  await expect(page.locator('#ui-text-productName')).toHaveValue('Kept draft')
  await expect(section.getByRole('button', { name: 'Close', exact: true })).toBeVisible()
  await expectAccessible()
})

test('T054 previews sanitized HTML and reports removed kinds at narrow widths', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('help-text-malicious')
  await page.goto('system/customize/ui-texts')
  const section = page.locator('#section-login-help')
  await expect(section.locator('[data-html-preview]')).toContainText('Help')
  await expect(section.locator('[data-html-removed]')).toContainText('scripts')
  await expect(section.locator('[data-html-removed]')).toContainText('images')
  await expect(section.locator('script, img, iframe, [onclick]')).toHaveCount(0)
  expect(await page.evaluate(() => 'htmlExecuted' in window)).toBe(false)
  await expectAccessible()
  await expectNoHorizontalScroll(page, { widths: [320, 360] })
  await section.getByRole('button', { name: /^Edit / }).click()
  await expect(section.locator('textarea')).toHaveValue(/<script>/)
  await expectAccessible()
})

test('T054 saves a partial patch, refreshes public branding and keeps plain text literal', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('ui-texts-custom')
  await page.goto('system/customize/ui-texts')
  const section = page.locator('#section-names')
  await section.getByRole('button', { name: /^Edit / }).click()
  await page.locator('#ui-text-productName').fill('Acme & Co Mail')
  await page.locator('#ui-text-pageTitle').fill('<b>Acme Mail</b>')
  await expectAccessible()
  await section.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(section.locator('form')).toHaveCount(0)
  await expect(page).toHaveTitle(/<b>Acme Mail<\/b>/)
  const writes = (await mockApi.requests()).filter((r) => r.operationId === 'updateUiTexts')
  expect(writes).toHaveLength(1)
  expect(writes[0]!.body).toEqual({ productName: 'Acme & Co Mail', pageTitle: '<b>Acme Mail</b>' })
  expect(writes[0]!.headers['if-match']).toMatch(/^"/)
  await expect(section.locator('b')).toHaveCount(0)
  await expect(section).toContainText('<b>Acme Mail</b>')
  await expectAccessible()
  await signOutFromMenu(page)
  await expect(page.locator('main').getByText('Acme & Co Mail', { exact: true })).toBeVisible()
})

test('T054 previews every announcement type and disabling updates the shell', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('announcement-warning-active')
  await page.goto('system/customize/ui-texts')
  const section = page.locator('#section-announcement')
  await section.getByRole('button', { name: /^Edit / }).click()
  for (const type of ['info', 'warning', 'danger', 'neutral']) {
    await page.locator('#ui-text-announcement-type').selectOption(type)
    await expect(section.locator('[data-announcement]')).toBeVisible()
    await expectAccessible()
  }
  await page.locator('#ui-text-announcement-active').uncheck()
  await section.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.locator('[data-announcement]')).toHaveCount(0)
  await page.reload()
  await expect(page.locator('#section-announcement')).toBeVisible()
  await expect(page.locator('[data-announcement]')).toHaveCount(0)
})

test('T054 keeps unsaved text when leaving is cancelled and focuses linked errors', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('ui-texts-custom')
  await page.goto('system/customize/ui-texts')
  const section = page.locator('#section-names')
  await section.getByRole('button', { name: /^Edit / }).click()
  await page.locator('#ui-text-productName').fill('x'.repeat(256))
  await page.locator('#ui-text-pageTitle').fill('y'.repeat(256))
  await section.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(section.locator('[aria-invalid="true"]')).toHaveCount(2)
  await section.locator('a[href="#ui-text-productName"]').click()
  await expect(page.locator('#ui-text-productName')).toBeFocused()
  expect(await mockApi.countRequests('updateUiTexts')).toBe(0)
  await expectAccessible()
  const nav = page.getByRole('navigation', { name: 'Customize', exact: true })
  const disclosure = nav.getByRole('button')
  if (await disclosure.isVisible()) await disclosure.click()
  await nav.getByRole('link', { name: 'Change logo', exact: true }).click()
  await expect(page.getByRole('alertdialog')).toBeVisible()
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: /stay|keep/i })
    .click()
  await expect(page.locator('#ui-text-productName')).toHaveValue('x'.repeat(256))
})

test('T054 demo mode is readable and offers no text editing', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('settings-demo-mode')
  await page.goto('system/customize/ui-texts')
  await expect(page.locator('[data-demo-mode]')).toContainText('Demo Mode')
  await expect(page.locator('main button').filter({ hasText: /^Edit$/ })).toHaveCount(0)
  await expectAccessible()
})
