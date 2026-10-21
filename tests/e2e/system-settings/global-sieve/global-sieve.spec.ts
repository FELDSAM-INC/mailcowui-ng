import { expect, test } from '../../fixtures/test'
const path = 'system/global-sieve-filters'

test('blocks oversized scripts before sending and preserves both drafts when navigation is cancelled', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('global-sieve-default')
  await page.goto(path)
  const pre = page.locator('[data-global-filter=prefilter]')
  await pre.getByRole('button', { name: 'Edit', exact: true }).click()
  await pre.locator('textarea').fill('#' + 'x'.repeat(1_048_576))
  await pre.getByRole('button', { name: 'Save changes', exact: true }).click()
  expect(await mockApi.countRequests('replaceGlobalSieveFilter')).toBe(0)
  await expect(pre.locator('textarea')).toHaveAttribute('aria-invalid', 'true')
  await pre.locator('textarea').fill('# My pre-filter\nkeep;')
  const post = page.locator('[data-global-filter=postfilter]')
  await post.getByRole('button', { name: 'Edit', exact: true }).click()
  await post.locator('textarea').fill('# My post-filter\nkeep;')
  await pre.getByRole('link', { name: 'History', exact: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Stay', exact: true }).click()
  await expect(pre.locator('textarea')).toHaveValue('# My pre-filter\nkeep;')
  await expect(post.locator('textarea')).toHaveValue('# My post-filter\nkeep;')
})

test('shows both global filters with consistent tabs, no presets and safe script validation', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('global-sieve-default')
  await page.goto(path)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Global Sieve filters')
  await expect(
    page.getByText('Runs before every mailbox’s own filters.', { exact: true }),
  ).toBeVisible()
  await expect(page.getByText(/Runs after every mailbox’s own filters/)).toBeVisible()
  await expect(page.locator('[data-preset-picker]')).toHaveCount(0)
  const pre = page.locator('[data-global-filter=prefilter]')
  await pre.getByRole('button', { name: 'Edit', exact: true }).click()
  await pre.locator('textarea').fill('# comment\nkeep')
  await pre.getByRole('button', { name: 'Validate', exact: true }).click()
  await expect(pre.locator('q[lang=en]')).toHaveText(/Expected semicolon after keep/)
  await pre.getByRole('button', { name: 'Go to line 2', exact: true }).click()
  await expect(pre.locator('textarea')).toBeFocused()
  expect(
    await pre
      .locator('textarea')
      .evaluate((input: HTMLTextAreaElement) =>
        input.value.slice(input.selectionStart, input.selectionEnd),
      ),
  ).toBe('keep')
  await pre.locator('textarea').fill('# comment\nkeep;')
  await pre.getByRole('button', { name: 'Validate', exact: true }).click()
  await expect(pre.locator('[data-filter-notice]')).toContainText('Nothing was saved or restarted')
  expect(
    (await mockApi.requests())
      .filter((request) => request.operationId === 'replaceGlobalSieveFilter')
      .every((request) => request.path.includes('validateOnly=true')),
  ).toBe(true)
  await page.evaluate(() => scrollTo(0, 0))
  await expectAccessible()
  await expectNoHorizontalScroll()
})

for (const mode of ['now', 'later', 'failed'] as const)
  test(`saves only after confirmation and reports ${mode} restart outcome`, async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
    expectTouchTargets,
  }) => {
    await mockApi.use(mode === 'failed' ? 'global-sieve-restart-fails' : 'global-sieve-default')
    await page.goto(path)
    const pre = page.locator('[data-global-filter=prefilter]')
    await pre.getByRole('button', { name: 'Edit', exact: true }).click()
    await pre.locator('textarea').fill('')
    await pre.getByRole('button', { name: 'Save changes', exact: true }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toContainText(
      'briefly interrupts IMAP, POP3 and mail delivery for every user',
    )
    await expect(dialog).toContainText('An empty script means no global filter')
    await expect(
      dialog.getByRole('radio', { name: 'Restart the mail service now', exact: true }),
    ).toBeChecked()
    expect(await mockApi.countRequests('replaceGlobalSieveFilter')).toBe(0)
    await expectAccessible()
    await expectNoHorizontalScroll()
    await expectTouchTargets()
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(pre.locator('textarea')).toHaveValue('')
    expect(await mockApi.countRequests('replaceGlobalSieveFilter')).toBe(0)
    await pre.getByRole('button', { name: 'Save changes', exact: true }).click()
    if (mode === 'later')
      await dialog.getByRole('radio', { name: 'Apply at the next restart', exact: true }).check()
    await dialog.getByRole('button', { name: 'Save changes', exact: true }).click()
    await expect(pre.locator('[data-filter-notice]')).toContainText(
      'Filter was successfully written to file',
    )
    await expect(pre.locator('[data-filter-notice]')).toContainText(
      mode === 'now' ? 'Dovecot was restarted successfully' : 'takes effect at the next restart',
    )
    if (mode === 'failed')
      await expect(pre.locator('[data-filter-notice]')).toContainText('Dovecot failed to restart')
    await expect(pre.locator('textarea')).toHaveAttribute('readonly', '')
    const writes = (await mockApi.requests()).filter(
      (request) => request.operationId === 'replaceGlobalSieveFilter',
    )
    expect(writes).toHaveLength(1)
    expect(writes[0]!.headers['if-match']).toBe('"global-pre-1"')
    expect(writes[0]!.body).toMatchObject({ script: '', deferRestart: mode === 'later' })
  })

test('keeps drafts for missing files and outdated saves, and requires a new restart confirmation', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('global-sieve-file-missing')
  await page.goto(path)
  const post = page.locator('[data-global-filter=postfilter]')
  await post.getByRole('button', { name: 'Edit', exact: true }).click()
  await post.locator('textarea').fill('keep;')
  await post.getByRole('button', { name: 'Save changes', exact: true }).click()
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Save changes', exact: true })
    .click()
  await expect(post.locator('[data-unavailable]')).toContainText('Nothing was saved or restarted')
  await expect(post.locator('textarea')).toHaveValue('keep;')
  await post.getByRole('button', { name: 'Cancel', exact: true }).click()
  const pre = page.locator('[data-global-filter=prefilter]')
  await pre.getByRole('button', { name: 'Edit', exact: true }).click()
  await pre.locator('textarea').fill('# Mine\nkeep;')
  await mockApi.patch({
    settings: {
      globalFilters: [
        { id: 'prefilter', script: '# Another admin\nkeep;', etag: '"new-global"' },
        { id: 'postfilter', script: 'keep;', etag: '"post-2"' },
      ],
    },
  })
  await pre.getByRole('button', { name: 'Save changes', exact: true }).click()
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Save changes', exact: true })
    .click()
  await expect(pre.locator('[data-outdated]')).toBeVisible()
  await expect(pre.locator('textarea')).toHaveValue('# Mine\nkeep;')
  await pre.getByRole('button', { name: 'Save again', exact: true }).click()
  await expect(page.getByRole('alertdialog')).toBeVisible()
  await page
    .getByRole('alertdialog')
    .getByRole('radio', { name: 'Apply at the next restart', exact: true })
    .check()
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Save changes', exact: true })
    .click()
  await expect(pre.locator('[data-filter-notice]')).toBeVisible()
  const last = (await mockApi.requests())
    .filter((request) => request.operationId === 'replaceGlobalSieveFilter')
    .at(-1)!
  expect(last.headers['if-match']).toBe('"new-global"')
})

for (const role of ['settings-domain-admin', 'settings-mailbox-user'])
  test(`${role} cannot read global scripts`, async ({ page, mockApi }) => {
    await mockApi.use(role)
    await page.goto(path)
    await expect(page.getByRole('heading', { name: 'No access', exact: true })).toBeVisible()
    expect(await mockApi.countRequests('listGlobalSieveFilters')).toBe(0)
  })
