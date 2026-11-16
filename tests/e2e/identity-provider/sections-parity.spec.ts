import { expect, test } from '../fixtures/test'
import type { IdentitySyncStatus } from '@/features/identity-providers/provider/synchronisation-api'

for (const provider of ['ldap', 'keycloak'] as const) {
  test(`${provider}: connection, templates, offboarding and group settings stay discoverable`, async ({
    page,
    mockApi,
    expectNoHorizontalScroll,
  }) => {
    await mockApi.use(`idp-${provider}`, {
      identityProvider: { capabilities: { identitySynchronisation: true } },
    })
    const data: IdentitySyncStatus = {
      supported: true,
      canSync: true,
      provider,
      enabled: false,
      etag: '"sync-1"',
      runs: [],
      counts: { accounts: 10, linked: 8, disabled: 0, missing: 0 },
      settings: {
        offboarding: false,
        offboardingLimit: 10,
        groupSync: false,
        groupAutocreate: true,
        groupDefaultDomain: '',
        groupPaths: [],
        idAttribute: '',
        disabledFilter: '',
        groupBaseDn: '',
        groupFilter: '',
        groupNameAttribute: 'cn',
        groupMemberMode: 'memberof',
        groupMemberAttribute: 'member',
      },
    }
    const writes: unknown[] = []
    await page.route('**/api/v2/identity-provider/synchronisation', async (route) => {
      if (route.request().method() === 'PATCH') {
        const patch = route.request().postDataJSON()
        writes.push(patch)
        Object.assign(data.settings, patch)
        data.etag = '"sync-2"'
      }
      await route.fulfill({ json: { data } })
    })
    await page.goto('identity-providers/provider?edit=provider')
    for (const name of ['Connection', 'Login', 'Mailbox templates', 'Synchronization']) {
      await expect(page.getByRole('heading', { name, exact: true })).toBeVisible()
    }
    for (const name of ['Offboarding', 'Groups']) {
      await expect(page.getByRole('heading', { name, exact: true })).toBeVisible()
    }
    const order = await page
      .locator('#section-provider select, #idp-attributeMapping-add')
      .evaluateAll((elements) => elements.map((e) => e.id))
    expect(order.indexOf('idp-defaultTemplate')).toBeLessThan(
      order.indexOf('idp-attributeMapping-add'),
    )
    await page
      .locator('#section-provider')
      .getByRole('button', { name: 'Cancel', exact: true })
      .click()
    await page.getByRole('button', { name: 'Edit Groups', exact: true }).click()
    await page.locator('#identity-sync-groupSync').check()
    if (provider === 'ldap') {
      await page.locator('#identity-sync-groupBaseDn').fill('ou=groups,dc=example,dc=org')
      await page.locator('#identity-sync-groupFilter').fill('(objectClass=group)')
      await page.locator('#identity-sync-groupMemberMode').selectOption('ad_chain')
      await expect(page.locator('#identity-sync-groupPaths')).toHaveCount(0)
    } else {
      await page.locator('#identity-sync-groupPaths').fill('/staff, /teams/*')
    }
    await expectNoHorizontalScroll(page, { widths: [360, 1440] })
    await page
      .locator('#section-identity-sync-groups')
      .getByRole('button', { name: 'Save', exact: true })
      .click()
    await expect(page.locator('#identity-sync-groupSync')).toHaveCount(0)
    expect(writes).toEqual([
      provider === 'ldap'
        ? {
            groupSync: true,
            groupBaseDn: 'ou=groups,dc=example,dc=org',
            groupFilter: '(objectClass=group)',
            groupMemberMode: 'ad_chain',
          }
        : { groupSync: true, groupPaths: ['/staff', '/teams/*'] },
    ])
    await page.getByRole('button', { name: 'Edit Offboarding', exact: true }).click()
    await page.locator('#identity-sync-offboarding').check()
    await page.locator('#identity-sync-offboardingLimit').fill('25')
    await page
      .locator('#section-identity-sync-offboarding')
      .getByRole('button', { name: 'Save', exact: true })
      .click()
    await expect(page.locator('#identity-sync-offboarding')).toHaveCount(0)
    expect(writes[1]).toEqual({ offboarding: true, offboardingLimit: 25 })
  })
}

test('global sync limits use KB/s per process and are linked from Options', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('sync-jobs-admin')
  await page.route('**/api/v2/me', async (route) => {
    const response = await route.fetch()
    const json = await response.json()
    json.data.features = { ...json.data.features, syncSources: true }
    await route.fulfill({ response, json })
  })
  const data = { maxParallel: 4, maxBytesPerSecond: 1048576, etag: '"queue-1"' }
  const writes: unknown[] = []
  await page.route('**/api/v2/sync-queue/settings', async (route) => {
    if (route.request().method() === 'PATCH') {
      const body = route.request().postDataJSON()
      writes.push(body)
      Object.assign(data, body)
    }
    await route.fulfill({ json: { data } })
  })
  await page.goto('system/sync-jobs')
  await expect(page.getByRole('heading', { name: 'Global settings', exact: true })).toBeVisible()
  await expect(
    page.locator('[data-section-navigation] a[href="/ng/system/sync-jobs"]'),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Edit Sync-job settings' }).click()
  await expect(page.locator('#queue-maxBytesPerSecond')).toHaveValue('1024')
  await page.locator('#queue-maxParallel').fill('8')
  await page.locator('#queue-maxBytesPerSecond').fill('64')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.locator('#queue-maxParallel')).toHaveCount(0)
  expect(writes).toEqual([{ maxParallel: 8, maxBytesPerSecond: 65536 }])
})
