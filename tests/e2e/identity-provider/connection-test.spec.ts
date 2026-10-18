// UI 012 US1 and US4, legacy's Test Connection (T018, T067): the entered values are tested, never
// stored; the outcome is legacy's alert text plus the category legacy cannot report; one test at a
// time with a 90-second limit; the client rules and the secret rule come first.
import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { openProvider, requestsOf } from './helpers'

async function fillLdap(page: Page) {
  await page.locator('#idp-type').selectOption({ label: 'LDAP' })
  await page.locator('#idp-hosts').fill('ldap1.example.org')
  await page.locator('#idp-baseDn').fill('dc=example,dc=org')
  await page.locator('#idp-bindDn').fill('cn=admin,dc=example,dc=org')
  await page.locator('#idp-bindPassword').fill('ldap-secret')
}

const testButton = (page: Page) => page.getByRole('button', { name: 'Test Connection' })
const result = (page: Page) => page.locator('[data-test-result]')

test.describe('test the connection', () => {
  test('US1-AS3 FR-036 credentials rejected: the classic failure, the category, nothing saved', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('idp-none', {
      identityProvider: { connectionTest: { outcome: 'credentialsRejected' } },
    })
    await openProvider(page)
    await fillLdap(page)
    await testButton(page).click()
    await expect(result(page)).toContainText('Connection failed')
    await expect(result(page)).toContainText('The provider rejected the credentials.')
    await expect(page.getByRole('status').filter({ has: result(page) })).toBeVisible()
    const tests = await requestsOf(mockApi, 'testIdentityProviderConnection')
    expect(tests).toHaveLength(1)
    expect(tests[0]!.body).toMatchObject({
      type: 'ldap',
      hosts: ['ldap1.example.org'],
      baseDn: 'dc=example,dc=org',
    })
    expect(await requestsOf(mockApi, 'saveIdentityProvider')).toEqual([])
    await expectAccessible()
  })

  test('FR-036 FR-075 every category has its text, success its icon and text', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('idp-none', {
      identityProvider: {
        connectionTest: {
          outcome: 'success',
          providerStatus: 404,
          sequence: ['unreachable', 'timedOut', 'tlsCertificateRejected', 'unexpectedResponse'],
        },
      },
    })
    await openProvider(page)
    await fillLdap(page)
    for (const text of [
      'The provider could not be reached.',
      'The provider did not answer in time.',
      "The provider's TLS certificate was not accepted.",
      'Status: 404',
    ]) {
      await testButton(page).click()
      await expect(result(page)).toContainText(text)
    }
    await testButton(page).click()
    await expect(result(page)).toHaveAttribute('data-outcome', 'success')
    await expect(result(page)).toContainText('Connection successful')
    await expect(result(page).locator('svg')).toHaveCount(1)
  })

  test('FR-035 while running the action is busy; after 90 seconds "no result" and the test can run again', async ({
    page,
    mockApi,
  }) => {
    await page.clock.install()
    await mockApi.use('idp-none', {
      identityProvider: { connectionTest: { outcome: 'success', hang: true } },
    })
    await openProvider(page)
    await fillLdap(page)
    await testButton(page).click()
    await expect(testButton(page)).toBeDisabled()
    await expect(page.getByText('Testing the connection…')).toBeVisible()
    await page.clock.fastForward(90_000)
    await expect(page.locator('[data-test-no-result]')).toContainText(
      'No result was received within 90 seconds.',
    )
    await expect(testButton(page)).toBeEnabled()
  })

  test('FR-034 FR-038 a missing secret or an invalid address is marked, and no test is sent', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('idp-none')
    await openProvider(page)
    await page.locator('#idp-serverUrl').fill('not a url')
    await page.locator('#idp-realm').fill('example')
    await page.locator('#idp-clientId').fill('mailcow')
    await page.locator('#idp-version').fill('26')
    await page.locator('#idp-legacyReturnUrl').fill('https://mail.example.org')
    await testButton(page).click()
    await expect(page.locator('#idp-serverUrl-error')).toContainText(
      'Enter an absolute address starting with http:// or https://.',
    )
    await expect(page.locator('#idp-clientSecret-error')).toContainText('Required')
    expect(await requestsOf(mockApi, 'testIdentityProviderConnection')).toEqual([])
  })

  test('Edge: test while offline: the network message, and the test can run again', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('idp-none')
    await openProvider(page)
    await fillLdap(page)
    await page.route('**/api/v2/identity-provider/connection-tests', (route) => route.abort())
    await testButton(page).click()
    await expect(page.getByRole('alert').filter({ hasText: 'could not be reached' })).toBeVisible()
    await page.unroute('**/api/v2/identity-provider/connection-tests')
    await testButton(page).click()
    await expect(result(page)).toContainText('Connection successful')
  })

  test('FR-033 the stored configuration is tested without a secret in the request', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('idp-ldap')
    await openProvider(page)
    await page.locator('#section-provider').getByRole('button', { name: 'Test Connection' }).click()
    await expect(result(page)).toContainText('Connection successful')
    const [sent] = await requestsOf(mockApi, 'testIdentityProviderConnection')
    expect(sent!.body).toMatchObject({ type: 'ldap', hosts: ['ldap1.example.org'] })
    expect(sent!.body).not.toHaveProperty('bindPassword')
    await expectAccessible()
  })
})
