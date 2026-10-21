import { expect, test } from '../../fixtures/test'
import { clickRowAction } from '../../fixtures/row-actions'

const rows = '[data-rule-id]'
test('T107 empty map adds a checked active rule with line navigation and refresh guidance', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('rspamd-rules-empty')
  await page.goto('system/rspamd-rules')
  await expect(page.getByText('No rules available', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Add rule', exact: true }).click()
  await expect(page.locator('#rule-active')).toBeChecked()
  await expect(page.getByRole('link', { name: 'Rspamd docs' })).toHaveAttribute(
    'href',
    'https://rspamd.com/doc/configuration/settings.html#settings-structure',
  )
  await page.locator('#rule-description').fill('Custom active rule')
  await page.locator('#rule-content').fill('# header\napply {\n symbols=[];')
  await page.locator('[data-rule-check]').click()
  await expect(page.getByRole('button', { name: 'Go to line 2', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Go to line 2', exact: true }).click()
  await expect(page.locator('#rule-content')).toBeFocused()
  expect(
    await page
      .locator('#rule-content')
      .evaluate((element: HTMLTextAreaElement) => element.selectionStart),
  ).toBe(9)
  await expectAccessible()
  await expectNoHorizontalScroll()
  await page.locator('#rule-content').fill('apply { symbols=["{", "}"]; }')
  await page.locator('[data-rule-check]').click()
  await expect(page.locator('[data-rule-checked]')).toBeVisible()
  const checks = (await mockApi.requests()).filter(
    (row) => row.operationId === 'createRspamdSettingsRule',
  )
  expect(checks.every((row) => row.path.includes('validateOnly=true'))).toBe(true)
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page).toHaveURL(/rspamd-rules\/1$/)
  await expect(page.locator('#rule-description')).toHaveValue('Custom active rule')
  await expect(page.getByText(/Active rule changes reach Rspamd at its next refresh/)).toBeVisible()
  await expectAccessible()
  await page
    .getByRole('main')
    .getByRole('link', { name: 'Rspamd settings map', exact: true })
    .last()
    .click()
  await expect(page.locator('[data-rule-id="1"]')).toContainText('Custom active rule')
  await expect(page.locator('[data-rule-id="1"]')).toContainText('Active')
})

test('T107 rule list sorts and restores content search, inactive filter and pagination from URL', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('rspamd-rules-30')
  await page.goto('system/rspamd-rules')
  await expect(page.locator(rows)).toHaveCount(25)
  await expect(page.locator(rows).first()).toHaveAttribute('data-rule-id', '1')
  await expectAccessible()
  await expectNoHorizontalScroll()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page).toHaveURL(/page=2/)
  await expect(page.locator(rows)).toHaveCount(5)
  await page.getByRole('searchbox', { name: 'Search:', exact: true }).fill('needle-content')
  await expect(page.locator(rows)).toHaveCount(3)
  await expect(page).not.toHaveURL(/page=/)
  await page.getByRole('combobox', { name: 'Active', exact: true }).selectOption('no')
  await page.getByRole('combobox', { name: 'Sort by', exact: true }).selectOption('description')
  await page.getByRole('button', { name: 'Ascending', exact: true }).click()
  await expect(page.locator(rows).first()).toHaveAttribute('data-rule-id', '30')
  await page.reload()
  await expect(page.locator(rows)).toHaveCount(3)
  await expect(page.locator(rows).first()).toHaveAttribute('data-rule-id', '30')
  await expect(page.getByRole('combobox', { name: 'Active', exact: true })).toHaveValue('no')
  if (await page.locator('table[data-rule-list]').count())
    await expect(
      page.getByRole('columnheader', { name: 'Short description', exact: true }),
    ).toHaveAttribute('aria-sort', 'descending')
})

test('T107 translated and unknown-key presets fill only an empty description and confirm replacement', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('rspamd-rules-empty')
  await page.goto('system/rspamd-rules/-/new')
  await page.locator('[data-preset="preset_4"] button').click()
  await expect(page.locator('#rule-description')).toHaveValue('Disable Rspamd for a domain')
  await expect(page.locator('#rule-content')).toHaveValue(/MAILCOW_WHITE/)
  await page.locator('#rule-description').fill('My description')
  await page.locator('[data-preset="zz_unknown"] button').click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toContainText('Replace editor content?')
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.locator('#rule-content')).toHaveValue(/MAILCOW_WHITE/)
  await page.locator('[data-preset="zz_unknown"] button').click()
  await dialog.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.locator('#rule-content')).toHaveValue('apply { symbols = ["EXAMPLE"]; }')
  await expect(page.locator('#rule-description')).toHaveValue('My description')
  await expect(page.getByRole('main')).not.toContainText('admin.rsettings_preset_999')
  await expectAccessible()
})

test('T107 effective map retries an unavailable service and copies read-only content with native fallback', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('settings-map-unavailable')
  await page.goto('system/rspamd-effective-map')
  await expect(page.getByRole('button', { name: 'Try again', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  const editor = page.locator('#effective-settings-map')
  await expect(editor).toHaveAttribute('readonly', '')
  await expect(editor).toHaveValue(/additional_settings_1/)
  await page.evaluate(() =>
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined }),
  )
  await page.getByRole('button', { name: 'Copy: Active settings map', exact: true }).click()
  await expect(editor).toBeFocused()
  expect(
    await editor.evaluate(
      (element: HTMLTextAreaElement) => element.selectionEnd - element.selectionStart,
    ),
  ).toBe((await editor.inputValue()).length)
  expect(await editor.evaluate((element) => element.tabIndex)).toBe(0)
  await page.keyboard.press('Tab')
  await page.keyboard.press('Shift+Tab')
  await expect(editor).toBeFocused()
  await expect(page.getByRole('main')).toContainText('did not allow copying')
  await expectAccessible()
  await expectNoHorizontalScroll(page, { widths: [320, 360] })
})

test('T107 outdated deletion rereads the rule and asks for a fresh confirmation', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('rspamd-rules-outdated')
  await page.goto('system/rspamd-rules')
  await clickRowAction(page, page.locator('[data-rule-id="1"]'), 'Remove: Rule 01')
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toContainText('Remove rule #1: Rule 01?')
  await expect(dialog).toContainText('next refresh')
  await dialog.getByRole('button', { name: 'Delete now', exact: true }).click()
  await expect(dialog).toContainText('Changed by another administrator')
  expect(await mockApi.countRequests('deleteRspamdSettingsRule')).toBe(1)
  await expectAccessible()
  await dialog.getByRole('button', { name: 'Delete now', exact: true }).click()
  await expect(page.locator(rows)).toHaveCount(0)
  await expect(page.getByRole('main')).toContainText('Removed settings map ID 1')
  expect(await mockApi.countRequests('deleteRspamdSettingsRule')).toBe(2)
})

test('T107 concurrent editing preserves the draft until explicit Save again', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('rspamd-rules-outdated')
  await page.goto('system/rspamd-rules/1')
  await page.locator('#rule-description').fill('My changed description')
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.locator('[data-rule-outdated]')).toContainText(
    'Changed by another administrator',
  )
  await expect(page.locator('#rule-description')).toHaveValue('My changed description')
  await expectAccessible()
  await page.getByRole('button', { name: 'Save again', exact: true }).click()
  await expect(page.locator('[data-rule-outdated]')).toHaveCount(0)
  await expect(page.locator('[data-rule-saved]')).toContainText('next refresh')
  await page.reload()
  await expect(page.locator('#rule-description')).toHaveValue('My changed description')
})

test('T107 missing rule has a usable return link', async ({ page, mockApi, expectAccessible }) => {
  await mockApi.use('rspamd-rules-empty')
  await page.goto('system/rspamd-rules/999')
  await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
  await expectAccessible()
  await page
    .getByRole('main')
    .getByRole('link', { name: 'Rspamd settings map', exact: true })
    .last()
    .click()
  await expect(page).toHaveURL(/system\/rspamd-rules$/)
})

for (const role of ['settings-domain-admin', 'settings-mailbox-user'])
  test(`T107 ${role} cannot open Rspamd settings rules`, async ({ page, mockApi }) => {
    await mockApi.use(role)
    await page.goto('system/rspamd-rules')
    await expect(page.getByRole('heading', { level: 1, name: /permission|access/i })).toBeVisible()
    expect(await mockApi.countRequests('listRspamdSettingsRules')).toBe(0)
  })

test('T107 editor wraps long lines at 320px and preserves drafts on cancelled navigation', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('rspamd-rules-empty')
  await page.goto('system/rspamd-rules/-/new')
  await page.locator('#rule-description').fill('Unsaved')
  const content = `# ${'word '.repeat(300)}`
  await page.locator('#rule-content').fill(content)
  await expect(page.locator('#rule-content')).toHaveAttribute('wrap', 'soft')
  await page.getByLabel('Wrap lines', { exact: true }).uncheck()
  await expect(page.locator('#rule-content')).toHaveAttribute('wrap', 'off')
  await expectNoHorizontalScroll(page, { widths: [320, 360] })
  await expectAccessible()
  await page
    .getByRole('main')
    .getByRole('link', { name: 'Rspamd settings map', exact: true })
    .last()
    .click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Stay', exact: true }).click()
  await expect(page.locator('#rule-content')).toHaveValue(content)
  await page.locator('#rule-description').fill('')
  await page.locator('#rule-content').fill('')
})
