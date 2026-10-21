import { expect, test } from '../../fixtures/test'
import { openNavigation } from '../../fixtures/flows'
import { permissionFlags } from '../../../mocks/scenarios/accounts'

// Story tests already deny overview/IP Check, policy, CORS/license, Rspamd UI/rules and
// global Sieve to both non-admin roles. Cover only the remaining pages and nested routes here.
const remainingSettingsRoutes = [
  'system/customize',
  'system/customize/ui-texts',
  'system/quota-notifications',
  'system/filter-maps',
  'system/filter-maps/global_mime_from_blacklist.map',
  'system/mass-mail/send',
  'system/mass-mail/jobs',
  'system/mass-mail/jobs/01JQ0000000000000000000001',
  'system/rspamd-rules/-/new',
  'system/rspamd-rules/1',
  'system/rspamd-effective-map',
  'system/password-reset-email',
] as const

for (const scenario of ['settings-domain-admin', 'settings-mailbox-user']) {
  test(`T168 ${scenario} cannot enter remaining settings pages, children or redirects`, async ({
    page,
    mockApi,
  }) => {
    test.setTimeout(60_000)
    await mockApi.use(scenario)
    const roleSpecificRoutes =
      scenario === 'settings-domain-admin'
        ? ['system/customize/colours', 'system/customize/login-page', 'system/customize/app-links']
        : ['system/customize/logos']
    for (const path of [...remainingSettingsRoutes, ...roleSpecificRoutes]) {
      await test.step(path, async () => {
        await page.goto(path)
        await expect(page.getByRole('heading', { name: 'No access', exact: true })).toBeVisible()
        await expect(page.getByRole('link', { name: 'History', exact: true })).toHaveCount(0)
      })
    }
    const navigation = await openNavigation(page)
    await expect(navigation.locator('a[href^="/ng/system"]')).toHaveCount(0)
    expect(
      (await mockApi.requests()).filter((request) =>
        /\/api\/v2\/(?:settings|capabilities\/settings|mass-mail-jobs|password-policy|license)(?:[/?]|$)/.test(
          request.path,
        ),
      ),
      'denied routes must not request settings capabilities, settings values or mail jobs',
    ).toEqual([])
    expect(await mockApi.countRequests('listPresets')).toBe(0)
  })
}

test('T168 mailbox users cannot load new Customize settings or preset-enabled Sieve creation', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('settings-mailbox-user')
  for (const path of [
    'system/customize/colours',
    'system/customize/login-page',
    'system/customize/app-links',
    'filters/new',
    'mailboxes/anna%40example.org/filters/new',
  ]) {
    await page.goto(path)
    await expect(page.getByRole('heading', { name: 'No access', exact: true })).toBeVisible()
    await expect(page.locator('[data-preset-picker]')).toHaveCount(0)
  }
  for (const operation of [
    'getSettingsCapabilities',
    'getBrandColors',
    'getLoginPageSettings',
    'getAppLinkSettings',
    'listPresets',
  ])
    expect(await mockApi.countRequests(operation), operation).toBe(0)
  await expectAccessible()
})

test('T168 a domain administrator with every permission flag off can save own-domain quota copies', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('quota-copies-example-org')
  await mockApi.setFlags('reseller', permissionFlags(false))
  await page.goto('domains/example.org')
  const section = page.locator('#section-quota-copies')
  await section.getByRole('button', { name: /^Edit / }).click()
  await page.locator('#quota-copies-recipients').fill('quota-observer@example.org')
  await page.locator('#quota-copies-active').check()
  await section.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(section.locator('[data-quota-copies-view]')).toContainText(
    'quota-observer@example.org',
  )
  await expect(section.getByRole('link', { name: 'History', exact: true })).toHaveCount(0)
  expect(await mockApi.countRequests('getSettingsCapabilities')).toBe(0)
  const writes = (await mockApi.requests()).filter(
    (request) => request.operationId === 'updateQuotaNotificationRecipients',
  )
  expect(writes).toHaveLength(1)
  expect(writes[0]?.body).toEqual({ recipients: ['quota-observer@example.org'], active: true })
})

test('T168 a mailbox user cannot reach quota copies even for its own mailbox domain', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('settings-mailbox-user')
  await page.goto('domains/example.org')
  await expect(page.getByRole('heading', { name: 'No access', exact: true })).toBeVisible()
  await expect(page.locator('#section-quota-copies')).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'History', exact: true })).toHaveCount(0)
  for (const operation of [
    'getQuotaNotificationRecipients',
    'updateQuotaNotificationRecipients',
    'getSettingsCapabilities',
  ])
    expect(await mockApi.countRequests(operation), operation).toBe(0)
})

test('T168 a domain administrator without filters cannot open scoped preset-enabled creation', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('filters-domain-admin-no-flag')
  await page.goto('mailboxes/anna%40example.org/filters/new')
  await expect(page.getByRole('heading', { name: 'No access', exact: true })).toBeVisible()
  await expect(page.locator('[data-preset-picker]')).toHaveCount(0)
  await expect(page.locator('[data-filter-form]')).toHaveCount(0)
  for (const operation of ['listPresets', 'createSieveFilter'])
    expect(await mockApi.countRequests(operation), operation).toBe(0)
})
