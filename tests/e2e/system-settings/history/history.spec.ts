import { expect, test } from '../../fixtures/test'

test('map History keeps its target filter and renders human-readable size changes', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('audit-settings-records')
  await page.goto('system/filter-maps/global_mime_from_blacklist.map')
  await page.getByRole('link', { name: 'History', exact: true }).click()
  await expect(page).toHaveURL(/targetType=rspamdRegexMap/)
  await expect(page).toHaveURL(/targetId=global_mime_from_blacklist.map/)
  await expect(page.getByText('Global filter map replaced', { exact: true }).last()).toBeVisible()
  await page.getByRole('button', { name: 'Show details', exact: true }).click()
  await expect(page.getByText('Previous size', { exact: true })).toBeVisible()
  await expect(page.getByText('1 KiB', { exact: true })).toBeVisible()
  await expect(page.getByText('2 KiB', { exact: true })).toBeVisible()
  await expect(page.getByText('admin (Administrator)', { exact: true })).toBeVisible()
  await expect(page.getByText('192.0.2.10', { exact: true })).toBeVisible()
  await page.evaluate(() => scrollTo(0, 0))
  await expectAccessible()
  await expectNoHorizontalScroll()
})

test('password history describes the change and confirmation without a password value', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('audit-settings-records')
  await page.goto('system/rspamd-web-interface')
  await page.getByRole('link', { name: 'History', exact: true }).click()
  await expect(page).toHaveURL(/targetType=rspamdUiPassword/)
  await page.getByRole('button', { name: 'Show details', exact: true }).click()
  await expect(page.getByText('Rspamd confirmed the change', { exact: true })).toBeVisible()
  await expect(page.getByText('changed', { exact: true })).toBeVisible()
  await expect(page.getByText('Yes', { exact: true })).toBeVisible()
  await expect(page.locator('main input[type=password]')).toHaveCount(0)
})

test('job history shows creation and completion counts and all settings targets are filterable', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('audit-settings-records')
  await page.goto('audit-log?targetType=massMailJob&targetId=01JB3K4M5N6P7Q8R9S0TVWXYZA')
  await expect(page.getByText('Mass mail queued', { exact: true }).last()).toBeVisible()
  await expect(page.getByText('Mass mail completed', { exact: true }).last()).toBeVisible()
  const detailButtons = page.getByRole('button', { name: 'Show details', exact: true })
  while (await detailButtons.count()) await detailButtons.first().click()
  await expect(page.getByText('Delivered: 8', { exact: true })).toBeVisible()
  await expect(page.getByText('Failed: 1', { exact: true })).toBeVisible()
  await expect(page.getByText('Skipped: 1', { exact: true })).toBeVisible()
  const filters = page.getByRole('button', { name: 'Filters', exact: true })
  if ((await filters.getAttribute('aria-expanded')) === 'false') await filters.click()
  for (const type of [
    'logo',
    'uiTexts',
    'loginPage',
    'appLinks',
    'brandColors',
    'ipCheck',
    'passwordPolicy',
    'passwordResetNotification',
    'quotaNotification',
    'quotaNotificationRecipients',
    'rspamdSettingsRule',
    'rspamdRegexMap',
    'globalSieveFilter',
    'rspamdUiPassword',
    'legacyApiCors',
    'massMailJob',
    'license',
  ]) {
    const option = page.locator(`select option[value="${type}"]`)
    await expect(option).toHaveCount(1)
    expect(await option.textContent()).not.toContain('Unknown')
  }
  await page.evaluate(() => scrollTo(0, 0))
  await expectAccessible()
})

test('implemented settings History actions select the right target', async ({ page, mockApi }) => {
  await mockApi.use('audit-settings-records')
  for (const [path, type, id] of [
    ['system/filter-maps', 'rspamdRegexMap', ''],
    ['system/rspamd-rules', 'rspamdSettingsRule', ''],
    ['system/quota-notifications', 'quotaNotification', ''],
    ['system/password-policy', 'passwordPolicy', ''],
    ['system/ip-check', 'ipCheck', ''],
    ['system/global-sieve-filters', 'globalSieveFilter', 'prefilter'],
    ['system/customize/logos', 'logo', ''],
    ['system/customize/ui-texts', 'uiTexts', ''],
    ['system/customize/colours', 'brandColors', ''],
    ['system/customize/login-page', 'loginPage', ''],
    ['system/customize/app-links', 'appLinks', ''],
    ['system/mass-mail/jobs', 'massMailJob', ''],
    ['system/cors', 'legacyApiCors', ''],
    ['system/license', 'license', ''],
  ]) {
    await page.goto(path!)
    const link = page.locator(`main a[href*="targetType=${type}"]`).first()
    await expect(link).toBeVisible()
    await link.click()
    await expect(page.getByRole('heading', { name: 'Audit log', exact: true })).toBeVisible()
    expect(new URL(page.url()).searchParams.get('targetType')).toBe(type)
    if (id) expect(new URL(page.url()).searchParams.get('targetId')).toBe(id)
  }
})

test('global Sieve restart detail quotes markup and exposes bidi controls', async ({
  page,
  mockApi,
  guardRequests,
}) => {
  void guardRequests
  await mockApi.use('audit-settings-records')
  await page.goto('audit-log?targetType=globalSieveFilter&targetId=prefilter')
  await page.getByRole('button', { name: 'Show details', exact: true }).click()
  await expect(
    page.getByText('Restart failed; the script is saved and applies at the next restart', {
      exact: true,
    }),
  ).toBeVisible()
  await expect(page.locator('[data-marker]').filter({ hasText: 'U+202E' })).toBeVisible()
  await expect(page.locator('main unavailable')).toHaveCount(0)
})
