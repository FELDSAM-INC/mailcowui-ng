import type { Page } from '@playwright/test'
import type { IdentitySyncStatus } from '@/features/identity-providers/provider/synchronisation-api'
import { expect, test } from '../fixtures/test'

async function fillProvider(page: Page, provider: 'ldap' | 'keycloak') {
  await page.locator('#idp-type').selectOption(provider)
  if (provider === 'ldap') {
    await page.locator('#idp-hosts').fill('ldap.example.org')
    await page.locator('#idp-baseDn').fill('dc=example,dc=org')
    await page.locator('#idp-bindDn').fill('cn=admin,dc=example,dc=org')
    await page.locator('#idp-bindPassword').fill('ldap-secret')
  } else {
    await page.locator('#idp-serverUrl').fill('https://sso.example.org')
    await page.locator('#idp-realm').fill('example')
    await page.locator('#idp-version').fill('26.0.7')
    await page.locator('#idp-clientId').fill('mailcow')
    await page.locator('#idp-clientSecret').fill('kc-secret')
    await page.locator('#idp-legacyReturnUrl').fill('https://mail.example.org')
  }
}

function syncStatus(provider: 'ldap' | 'keycloak'): IdentitySyncStatus {
  return {
    supported: true,
    canSync: true,
    provider,
    enabled: false,
    etag: '"new-sync"',
    runs: [],
    counts: { accounts: 0, linked: 0, disabled: 0, missing: 0 },
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
}

for (const provider of ['ldap', 'keycloak'] as const) {
  test(`${provider}: first setup includes offboarding and groups and saves them together`, async ({
    page,
    mockApi,
    expectNoHorizontalScroll,
  }) => {
    await mockApi.use('idp-none', {
      identityProvider: { capabilities: { identitySynchronisation: true } },
    })
    const data = syncStatus(provider)
    const writes: Record<string, unknown>[] = []
    await page.route('**/api/v2/identity-provider', async (route) => {
      if (route.request().method() !== 'PUT') return route.continue()
      const body = route.request().postDataJSON()
      expect(route.request().headers()['if-none-match']).toBe('*')
      writes.push(body)
      const response = await route.fetch()
      expect(response.status()).toBe(201)
      Object.assign(data.settings, body.syncSettings)
      await route.fulfill({ response })
    })
    await page.route('**/api/v2/identity-provider/synchronisation', async (route) => {
      expect(route.request().method()).toBe('GET')
      await route.fulfill({ json: { data } })
    })
    await page.goto('identity-providers/provider')
    await fillProvider(page, provider)
    for (const name of ['Offboarding', 'Groups'])
      await expect(page.getByRole('heading', { name, exact: true })).toBeVisible()
    await page.locator('#idp-syncSettings-offboarding').check()
    await page.locator('#idp-syncSettings-offboardingLimit').fill('25')
    await page.locator('#idp-syncSettings-groupSync').check()
    if (provider === 'ldap') {
      await page.locator('#idp-syncSettings-idAttribute').fill('entryuuid')
      await page.locator('#idp-syncSettings-disabledFilter').fill('(disabled=TRUE)')
      await page.locator('#idp-syncSettings-groupBaseDn').fill('ou=groups,dc=example,dc=org')
      await page.locator('#idp-syncSettings-groupFilter').fill('(objectClass=group)')
      await page.locator('#idp-syncSettings-groupMemberMode').selectOption('ad_chain')
    } else {
      // Type the separators, rather than filling the entire string at once.
      await page.locator('#idp-syncSettings-groupPaths').pressSequentially('/staff, /teams/*')
      await expect(page.locator('#idp-syncSettings-groupPaths')).toHaveValue('/staff, /teams/*')
    }
    await expectNoHorizontalScroll(page, { widths: [360, 1440] })
    await page
      .locator('[data-setup]')
      .getByRole('button', { name: 'Save changes', exact: true })
      .click()
    await expect(page.locator('[data-setup]')).toHaveCount(0)
    expect(writes).toHaveLength(1)
    expect(writes[0]!.syncSettings).toMatchObject({
      offboarding: true,
      offboardingLimit: 25,
      groupSync: true,
    })
    expect(writes[0]!.syncSettings).not.toHaveProperty(
      provider === 'ldap' ? 'groupPaths' : 'idAttribute',
    )
    await page.reload()
    await page.getByRole('button', { name: 'Edit Offboarding', exact: true }).click()
    await expect(page.locator('#identity-sync-offboarding')).toBeChecked()
    await expect(page.locator('#identity-sync-offboardingLimit')).toHaveValue('25')
    await page
      .locator('#section-identity-sync-offboarding')
      .getByRole('button', { name: 'Cancel', exact: true })
      .click()
    await page.getByRole('button', { name: 'Edit Groups', exact: true }).click()
    await expect(page.locator('#identity-sync-groupSync')).toBeChecked()
    await expect(
      page.locator(
        provider === 'ldap' ? '#identity-sync-groupMemberMode' : '#identity-sync-groupPaths',
      ),
    ).toHaveValue(provider === 'ldap' ? 'ad_chain' : '/staff, /teams/*')
  })
}

test('initial setup keeps group input and shows nested server errors before retry', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('idp-none', {
    identityProvider: { capabilities: { identitySynchronisation: true } },
  })
  const data = syncStatus('ldap')
  await page.route('**/api/v2/identity-provider/synchronisation', (route) =>
    route.fulfill({ json: { data } }),
  )
  let attempts = 0
  await page.route('**/api/v2/identity-provider', async (route) => {
    if (route.request().method() !== 'PUT') return route.continue()
    attempts += 1
    if (attempts === 1)
      return route.fulfill({
        status: 422,
        contentType: 'application/problem+json',
        json: {
          type: '/api/v2/problems/validation-failed',
          title: 'Validation failed',
          status: 422,
          errors: {
            'syncSettings.groupFilter': [
              {
                code: 'invalidFormat',
                params: { format: 'ldapFilter' },
                message: 'Invalid filter.',
              },
            ],
          },
        },
      })
    expect(route.request().postDataJSON().syncSettings).toMatchObject({
      groupSync: true,
      groupFilter: '(objectClass=group)',
    })
    Object.assign(data.settings, route.request().postDataJSON().syncSettings)
    await route.continue()
  })
  await page.goto('identity-providers/provider')
  await fillProvider(page, 'ldap')
  await page.locator('#idp-syncSettings-offboardingLimit').fill('')
  await page
    .locator('[data-setup]')
    .getByRole('button', { name: 'Save changes', exact: true })
    .click()
  await expect(page.locator('#idp-syncSettings-offboardingLimit')).toHaveAttribute(
    'aria-invalid',
    'true',
  )
  expect(attempts).toBe(0)
  await page.locator('#idp-syncSettings-offboardingLimit').fill('10')
  await page.locator('#idp-syncSettings-groupSync').check()
  await page.locator('#idp-syncSettings-groupFilter').fill('(broken')
  await page
    .locator('[data-setup]')
    .getByRole('button', { name: 'Save changes', exact: true })
    .click()
  await expect(page.locator('#idp-syncSettings-groupFilter')).toHaveAttribute(
    'aria-invalid',
    'true',
  )
  await expect(page.locator('#idp-syncSettings-groupFilter')).toHaveValue('(broken')
  await expect(page.locator('#idp-syncSettings-groupSync')).toBeChecked()
  await expect(page.locator('#idp-bindPassword')).toHaveValue('')
  await page.locator('#idp-syncSettings-groupFilter').fill('(objectClass=group)')
  await page.locator('#idp-bindPassword').fill('ldap-secret')
  await page
    .locator('[data-setup]')
    .getByRole('button', { name: 'Save changes', exact: true })
    .click()
  await expect(page.locator('[data-setup]')).toHaveCount(0)
  expect(attempts).toBe(2)
})

test('type switching retains sync drafts; OIDC and older mailcow hide unsupported settings', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('idp-none', {
    identityProvider: { capabilities: { identitySynchronisation: true } },
  })
  await page.goto('identity-providers/provider')
  await page.locator('#idp-syncSettings-groupPaths').fill('/staff')
  await page.locator('#idp-type').selectOption('ldap')
  await expect(page.locator('#idp-syncSettings-groupPaths')).toHaveCount(0)
  await expect(page.locator('#idp-syncSettings-offboarding')).toBeVisible()
  await page.locator('#idp-type').selectOption('genericOidc')
  await expect(page.locator('[id^="idp-syncSettings-"]')).toHaveCount(0)
  await page.locator('#idp-type').selectOption('keycloak')
  await expect(page.locator('#idp-syncSettings-groupPaths')).toHaveValue('/staff')
  await mockApi.use('idp-none', {
    identityProvider: { capabilities: { identitySynchronisation: false } },
  })
  await page.reload()
  await expect(page.locator('#idp-type')).toBeVisible()
  await expect(page.locator('[id^="idp-syncSettings-"]')).toHaveCount(0)
})
