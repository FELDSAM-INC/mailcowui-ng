// UI 012 US1, setting up the identity provider (T017), on the classic Identity Provider tab as one
// form (plan "Legacy form map"): legacy's description, provider select and fields per type in
// legacy's order, the capabilities' defaults, the client rules at their fields, the write-only
// secret, the app's return addresses, the attribute mapping and the create-only save.
import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { isMobile, isNarrow, openProvider, requestsOf } from './helpers'

const SAVED = /Changes to object\s+have been saved/

async function chooseType(page: Page, label: 'Keycloak' | 'Generic-OIDC' | 'LDAP') {
  await page.locator('#idp-type').selectOption({ label })
}

async function fillLdap(page: Page) {
  await chooseType(page, 'LDAP')
  await page.locator('#idp-hosts').fill('ldap1.example.org, ldap2.example.org')
  await page.locator('#idp-baseDn').fill('dc=example,dc=org')
  await page.locator('#idp-attributeField').fill('title')
  await page.locator('#idp-bindDn').fill('cn=admin,dc=example,dc=org')
  await page.locator('#idp-bindPassword').fill('ldap-secret')
}

const save = (page: Page) => page.getByRole('button', { name: 'Save changes', exact: true }).click()

test.describe('set up the identity provider', () => {
  test('US1-AS1 FR-004 FR-011 the classic tab: description, Keycloak chosen, legacy fields and defaults per type', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
    expectTouchTargets,
  }) => {
    await mockApi.use('idp-none')
    await openProvider(page)
    const main = page.getByRole('main')
    await expect(main).toContainText('Configure an external Provider for Authentication')
    await expect(main).not.toContainText('not configured')
    await expect(page.locator('#idp-type')).toHaveValue('keycloak')
    const form = page.locator('[data-setup]')
    for (const label of [
      'Server Url',
      'Realm',
      'Client ID',
      'Client Secret',
      'Redirect Url',
      'Version',
    ]) {
      await expect(form.getByText(label, { exact: false }).first()).toBeVisible()
    }
    await expect(form).toContainText('view-users')
    await expect(form.getByRole('switch', { name: 'Mailpassword Flow' })).not.toBeChecked()
    await expect(form.getByRole('switch', { name: 'Auto-create users on login' })).toBeChecked()
    await expect(page.locator('#idp-syncInterval')).toHaveValue('15')
    await expectAccessible()
    if (isMobile(page)) {
      await expectNoHorizontalScroll()
      await expectTouchTargets()
    }

    await chooseType(page, 'LDAP')
    await expect(form).toContainText('Enter one or more LDAP hosts, separated by commas.')
    await expect(page.locator('#idp-port')).toHaveValue('389')
    await expect(page.locator('#idp-usernameField')).toHaveAttribute('placeholder', 'mail')
    await expect(form.getByRole('switch', { name: 'Use SSL' })).not.toBeChecked()
    await expect(page.locator('#idp-serverUrl')).toHaveCount(0)
    await expectAccessible()

    await chooseType(page, 'Generic-OIDC')
    await expect(page.locator('#idp-authorizationEndpoint')).toBeVisible()
    await expect(page.locator('#idp-scopes')).toHaveAttribute(
      'placeholder',
      'openid profile email mailcow_template',
    )
    await expect(page.locator('#idp-syncInterval')).toHaveCount(0)
    await expect(form.getByRole('switch', { name: 'Import Users' })).toHaveCount(0)
    await expectAccessible()
  })

  test('FR-019 SSL and StartTLS are legacy switches of which only one is on', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('idp-none')
    await openProvider(page)
    await chooseType(page, 'LDAP')
    const ssl = page.getByRole('switch', { name: 'Use SSL' })
    const tls = page.getByRole('switch', { name: 'Use StartTLS' })
    await ssl.check()
    await expect(page.getByText('it will be automatically overridden to use 636')).toBeVisible()
    await tls.check()
    await expect(ssl).not.toBeChecked()
    await ssl.check()
    await expect(tls).not.toBeChecked()
  })

  test('US1-AS5 FR-018 FR-069 the rules are marked at their fields with a summary, and nothing is sent', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('idp-none')
    await openProvider(page)
    await page.locator('#idp-serverUrl').fill('sso.example.org')
    await page.locator('#idp-realm').fill('a/b')
    await page.locator('#idp-version').fill('26.x')
    await save(page)
    const summary = page.getByRole('heading', { name: 'Please correct the following' })
    await expect(summary).toBeVisible()
    await expect(page.locator('#idp-serverUrl')).toHaveAttribute('aria-invalid', 'true')
    await expect(page.locator('#idp-realm-error')).toContainText(
      'Enter the realm name without a slash.',
    )
    await expect(page.locator('#idp-version-error')).toContainText(
      'Enter a version of up to four numbers',
    )
    await expect(page.locator('#idp-clientSecret-error')).toContainText(
      'Required: no secret is stored for this provider type yet.',
    )
    await expectAccessible()

    await chooseType(page, 'LDAP')
    await page
      .locator('#idp-hosts')
      .fill(Array.from({ length: 11 }, (_, i) => `ldap${i}.example.org`).join(','))
    await page.locator('#idp-port').fill('70000')
    await page.locator('#idp-filter').fill('(a=b')
    await page.locator('#idp-syncInterval').fill('10081')
    await page.getByRole('button', { name: 'Add: Attribute Mapping' }).click()
    await page.locator('#idp-attributeMapping-0-attributeValue').fill('staff')
    await page.locator('#idp-attributeMapping-0-template').selectOption('Staff')
    await page.getByRole('button', { name: 'Add: Attribute Mapping' }).click()
    await page.locator('#idp-attributeMapping-1-attributeValue').fill('staff')
    await page.locator('#idp-attributeMapping-1-template').selectOption('Students')
    await save(page)
    await expect(page.locator('#idp-hosts-error')).toContainText('Enter at most 10 entries.')
    await expect(page.locator('#idp-port-error')).toContainText('Enter a value from 1 to 65,535.')
    await expect(page.locator('#idp-filter-error')).toContainText(
      'Enter a filter that starts with ( and ends with )',
    )
    await expect(page.locator('#idp-syncInterval-error')).toContainText(
      'Enter a value from 1 to 10,080.',
    )
    await expect(page.locator('#idp-attributeMapping-1-attributeValue-error')).toContainText(
      'This value is entered more than once.',
    )
    const link = page.getByRole('link', { name: 'Enter a value from 1 to 65,535.' })
    await link.click()
    await expect(page.locator('#idp-port')).toBeFocused()
    expect(await requestsOf(mockApi, 'saveIdentityProvider')).toEqual([])
    await expectAccessible()
  })

  test('FR-024 FR-026 the secret is required in the setup, masked with a reveal button, never filled in', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('idp-none')
    await openProvider(page)
    const secret = page.locator('#idp-clientSecret')
    await expect(secret).toHaveAttribute('type', 'password')
    await expect(secret).toHaveAttribute('autocomplete', 'new-password')
    await expect(secret).toHaveAttribute('data-1p-ignore', '')
    await expect(page.locator('label[for="idp-clientSecret"]')).toContainText('required')
    await secret.fill('top-secret')
    const reveal = page.getByRole('button', { name: 'Toggle password visibility' })
    await reveal.click()
    await expect(reveal).toHaveAttribute('aria-pressed', 'true')
    await expect(secret).toHaveAttribute('type', 'text')
    await reveal.click()
    await expect(secret).toHaveAttribute('type', 'password')
  })

  test("US1-AS7 FR-027 FR-076 the app's return addresses: listed with copy actions; a refused clipboard selects the address", async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: () => Promise.reject(new Error('denied')) },
      })
    })
    await mockApi.use('idp-none')
    await openProvider(page)
    const addresses = page.locator('[data-app-return-urls]')
    await expect(addresses).toContainText('Redirect addresses of this app for single sign-on')
    await expect(addresses.getByRole('textbox').first()).toHaveValue(
      'https://mail.example.org/ng/sso/return',
    )
    await expect(addresses.getByRole('link')).toHaveCount(0)
    await addresses
      .getByRole('button', { name: 'Copy: https://mail.example.org/ng/sso/return' })
      .click()
    await expect(addresses.getByRole('alert')).toContainText('The address is selected')
    await expect(addresses.getByRole('textbox').first()).toBeFocused()
    await chooseType(page, 'LDAP')
    await expect(page.locator('[data-app-return-urls]')).toHaveCount(0)
    await chooseType(page, 'Generic-OIDC')
    await expect(page.locator('[data-app-return-urls]')).toBeVisible()
    await expectAccessible()
  })

  test('FR-028 FR-029 return URLs and mapping entries: add and remove named after their entry, templates as choices', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('idp-none')
    await openProvider(page)
    await page.getByRole('button', { name: 'Add: Redirect Url' }).click()
    await expect(page.locator('#idp-additionalReturnUrls-0')).toBeFocused()
    await page.locator('#idp-additionalReturnUrls-0').fill('https://webmail.example.org')
    await page.getByRole('button', { name: 'Remove: https://webmail.example.org' }).click()
    await expect(page.locator('#idp-additionalReturnUrls-0')).toHaveCount(0)

    await expect(page.getByText('If no template is assigned to a user')).toBeVisible()
    const fallback = page.locator('#idp-defaultTemplate')
    await expect(fallback.locator('option').first()).toHaveText('-- Template --')
    await expect(fallback.locator('option')).toHaveText([
      '-- Template --',
      'Default',
      'Staff',
      'Students',
    ])
    await page.getByRole('button', { name: 'Add: Attribute Mapping' }).click()
    await expect(page.locator('#idp-attributeMapping-0-attributeValue')).toBeFocused()
    await page.locator('#idp-attributeMapping-0-attributeValue').fill('students')
    await page.locator('#idp-attributeMapping-0-template').selectOption('Students')
    await expect(page.locator('[data-mapping-entry]')).toHaveCount(1)
    await expectAccessible()
    await page.getByRole('button', { name: 'Remove: students' }).click()
    await expect(page.locator('[data-mapping-entry]')).toHaveCount(0)
  })

  test('Edge: no templates: the template choices offer only the empty choice', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('idp-no-templates')
    await openProvider(page)
    await expect(page.locator('#idp-defaultTemplate option')).toHaveText([
      '-- Template --',
      'Default',
    ])
  })

  test('Edge: template list fails: an error with a retry, and the entries are kept', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('idp-templates-fail')
    await openProvider(page)
    await page.locator('#idp-serverUrl').fill('https://sso.example.org')
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
    await expectAccessible()
    await mockApi.patch({ failures: { listMailboxTemplates: { status: 500, times: 0 } } })
    await page.getByRole('button', { name: 'Try again' }).click()
    await expect(page.getByRole('button', { name: 'Try again' })).toHaveCount(0)
    await expect(page.locator('#idp-defaultTemplate option')).toHaveCount(4)
    await expect(page.locator('#idp-serverUrl')).toHaveValue('https://sso.example.org')
  })

  test('US1-AS6 FR-012 saving LDAP sends one create-only save, then shows the stored values', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('idp-none')
    await openProvider(page)
    await fillLdap(page)
    await page.getByRole('button', { name: 'Add: Attribute Mapping' }).click()
    await page.locator('#idp-attributeMapping-0-attributeValue').fill('staff')
    await page.locator('#idp-attributeMapping-0-template').selectOption('Staff')
    const configBefore = (await requestsOf(mockApi, 'getPublicConfig')).length
    await save(page)
    await expect(page.locator('[data-page-status]')).toContainText(SAVED)
    const saves = await requestsOf(mockApi, 'saveIdentityProvider')
    expect(saves).toHaveLength(1)
    expect(saves[0]!.status).toBe(201)
    expect(saves[0]!.headers['if-none-match']).toBe('*')
    expect(saves[0]!.headers['if-match']).toBeUndefined()
    expect(saves[0]!.body).toMatchObject({
      type: 'ldap',
      hosts: ['ldap1.example.org', 'ldap2.example.org'],
      attributeMapping: [{ attributeValue: 'staff', template: 'Staff' }],
    })
    const section = page.locator('#section-provider')
    await expect(section.getByRole('heading', { level: 2, name: 'LDAP' })).toBeVisible()
    await expect(section.locator('[data-value="hosts"]')).toContainText(
      'ldap1.example.org, ldap2.example.org',
    )
    await expect(section.locator('[data-value="bindPassword"]')).toContainText('Stored')
    await expect(section).not.toContainText('ldap-secret')
    await expect
      .poll(async () => (await requestsOf(mockApi, 'getPublicConfig')).length)
      .toBeGreaterThan(configBefore)
    await expectAccessible()
  })

  for (const type of ['Keycloak', 'Generic-OIDC'] as const) {
    test(`US1-AS6 the same setup for ${type}`, async ({ page, mockApi }) => {
      test.skip(isNarrow(page), 'one viewport is enough for the second and third type')
      await mockApi.use('idp-none')
      await openProvider(page)
      await chooseType(page, type)
      if (type === 'Keycloak') {
        await page.locator('#idp-serverUrl').fill('https://sso.example.org/')
        await page.locator('#idp-realm').fill('example')
        await page.locator('#idp-version').fill('26.0.7')
      } else {
        await page.locator('#idp-authorizationEndpoint').fill('https://login.example.org/authorize')
        await page.locator('#idp-tokenEndpoint').fill('https://login.example.org/token')
        await page.locator('#idp-userInfoEndpoint').fill('https://login.example.org/userinfo')
      }
      await page.locator('#idp-clientId').fill('mailcow')
      await page.locator('#idp-clientSecret').fill('client-secret')
      await page.locator('#idp-legacyReturnUrl').fill('https://mail.example.org')
      await save(page)
      await expect(page.locator('[data-page-status]')).toContainText(SAVED)
      const section = page.locator('#section-provider')
      await expect(section.getByRole('heading', { level: 2, name: type })).toBeVisible()
      await expect(section.locator('[data-value="clientSecret"]')).toContainText('Stored')
      if (type === 'Keycloak') {
        await expect(section.locator('[data-value="serverUrl"]')).toHaveText(
          /https:\/\/sso\.example\.org$/,
        )
      }
    })
  }

  test('FR-016 leaving the setup with entries asks first, and Stay keeps them', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('idp-none')
    await openProvider(page)
    await page.locator('#idp-serverUrl').fill('https://sso.example.org')
    await page.getByRole('link', { name: 'History' }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toContainText('Leave without saving?')
    await dialog.getByRole('button', { name: 'Stay' }).click()
    await expect(page.locator('#idp-serverUrl')).toHaveValue('https://sso.example.org')
  })

  test('Edge: network loss during a save: nothing is reported as saved and the entries stay', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('idp-none')
    await openProvider(page)
    await fillLdap(page)
    await page.route('**/api/v2/identity-provider', (route) =>
      route.request().method() === 'PUT' ? route.abort() : route.fallback(),
    )
    await save(page)
    await expect(page.getByRole('alert').filter({ hasText: 'could not be reached' })).toBeVisible()
    await expect(page.locator('[data-page-status]')).toHaveCount(0)
    await expect(page.locator('#idp-baseDn')).toHaveValue('dc=example,dc=org')
  })

  test('Edge: very long values wrap at 360 px', async ({
    page,
    mockApi,
    expectNoHorizontalScroll,
  }) => {
    await mockApi.use('idp-none')
    await openProvider(page)
    await page.locator('#idp-serverUrl').fill(`https://sso.example.org/${'a'.repeat(1900)}`)
    await chooseType(page, 'LDAP')
    await page.locator('#idp-baseDn').fill(`ou=${'people'.repeat(150)},dc=example,dc=org`)
    await expectNoHorizontalScroll()
  })
})
