// UI 012 US4, maintaining the identity provider (T067 to T069), in the one section of the classic
// tab: the stored values read-only, Edit with its own save (merge patch, If-Match, legacy's message),
// the secret address rule, outdated and removed-elsewhere saves, the type change as a whole save,
// the in-use refusals, removal with legacy's confirmation, and History.
import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { isNarrow, openProvider, requestsOf } from './helpers'

const SECTION = '#section-provider'
const SAVED = /Changes to object\s+have been saved/

async function edit(page: Page, type: string) {
  await page.getByRole('button', { name: `Edit ${type}` }).click()
  await expect(page.getByRole('heading', { level: 2, name: type })).toBeFocused()
}

const save = (page: Page) => page.getByRole('button', { name: 'Save changes', exact: true }).click()
const section = (page: Page) => page.locator(SECTION)

test.describe('maintain the identity provider', () => {
  test('US4-AS1 FR-005 the stored values in legacy order, with Edit, Test Connection, Remove and History', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
    expectTouchTargets,
  }) => {
    await mockApi.use('idp-keycloak')
    await openProvider(page)
    await expect(section(page).getByRole('heading', { level: 2, name: 'Keycloak' })).toBeVisible()
    await expect(section(page).locator('[data-value="serverUrl"]')).toContainText(
      'https://sso.example.org',
    )
    await expect(section(page).locator('[data-value="clientSecret"]')).toContainText('Stored')
    await expect(section(page).locator('[data-value="mailpasswordFlow"]')).toContainText('Yes')
    await expect(section(page)).toContainText('https://webmail.example.org')
    await expect(section(page).locator('[data-value="attributeMapping"]')).toContainText('students')
    await expect(section(page).locator('[data-app-return-urls]')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Edit Keycloak' })).toBeVisible()
    await expect(section(page).getByRole('button', { name: 'Test Connection' })).toBeVisible()
    await expect(section(page).getByRole('button', { name: 'Remove' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'History' })).toHaveAttribute(
      'href',
      '/ng/audit-log?targetType=identityProvider',
    )
    await expectAccessible()
    if (isNarrow(page)) {
      await expectNoHorizontalScroll()
      await expectTouchTargets()
    }
  })

  test('FR-015 Edit opens full-screen on phones and in place on desktop; the address reopens it with an empty secret', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('idp-ldap')
    await openProvider(page)
    await edit(page, 'LDAP')
    await expect(page).toHaveURL(/edit=provider/)
    await expect(section(page)).toHaveAttribute('data-layout', isNarrow(page) ? 'full' : 'inline')
    await expect(page.locator('#idp-hosts')).toHaveValue('ldap1.example.org')
    await expect(page.locator('#idp-bindPassword')).toHaveValue('')
    await expect(
      page.getByText('A secret is stored. Leave the field empty to keep it.'),
    ).toBeVisible()
    await expectAccessible()
    await page.reload()
    await expect(page.locator('#idp-hosts')).toHaveValue('ldap1.example.org')
    await expect(page.locator('#idp-bindPassword')).toHaveValue('')
  })

  test('US4-AS3 saving sends the merge patch of the changed members with If-Match and shows the stored values', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('idp-ldap')
    await openProvider(page)
    await edit(page, 'LDAP')
    await page.locator('#idp-syncInterval').fill('60')
    await page.locator('#idp-attributeField').fill('Department')
    await save(page)
    await expect(section(page).getByRole('status')).toContainText(SAVED)
    const [patch] = await requestsOf(mockApi, 'updateIdentityProvider')
    expect(patch!.headers['content-type']).toContain('application/merge-patch+json')
    expect(patch!.headers['if-match']).toMatch(/^"idp/)
    expect(patch!.body).toEqual({ syncInterval: 60, attributeField: 'Department' })
    await expect(section(page).locator('[data-value="syncInterval"]')).toContainText('60')
    await expect(section(page).locator('[data-value="attributeField"]')).toContainText('department')
    await expect(page).not.toHaveURL(/edit=provider/)
    await expectAccessible()
  })

  test('US4-AS2 FR-025 new hosts require the secret before anything is sent; an unchanged address keeps it', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('idp-ldap')
    await openProvider(page)
    await edit(page, 'LDAP')
    await page.locator('#idp-hosts').fill('ldap2.example.org')
    await save(page)
    await expect(page.locator('#idp-bindPassword-error')).toContainText(
      'Enter it again: it would be sent to a new address.',
    )
    expect(await requestsOf(mockApi, 'updateIdentityProvider')).toEqual([])
    await page.locator('#idp-bindPassword').fill('new-secret')
    await save(page)
    await expect(section(page).getByRole('status')).toContainText(SAVED)
    const [patch] = await requestsOf(mockApi, 'updateIdentityProvider')
    expect(patch!.body).toEqual({ hosts: ['ldap2.example.org'], bindPassword: 'new-secret' })

    await edit(page, 'LDAP')
    await expect(page.locator('#idp-bindPassword')).toHaveValue('')
    await page.locator('#idp-port').fill('10389')
    await save(page)
    await expect(section(page).getByRole('status')).toContainText(SAVED)
    const patches = await requestsOf(mockApi, 'updateIdentityProvider')
    expect(patches[1]!.body).toEqual({ port: 10389 })
  })

  test('FR-026 the secret is emptied after a refused save and after Cancel', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('idp-template-missing')
    await openProvider(page)
    await edit(page, 'LDAP')
    await page.locator('#idp-bindPassword').fill('typed-secret')
    await save(page)
    await expect(page.locator('#idp-attributeMapping-1-template-error')).toContainText(
      'This mailbox template does not exist.',
    )
    await expect(page.locator('#idp-bindPassword')).toHaveValue('')
    await page.locator('#idp-bindPassword').fill('typed-again')
    await page.getByRole('button', { name: 'Cancel' }).click()
    await edit(page, 'LDAP')
    await expect(page.locator('#idp-bindPassword')).toHaveValue('')
  })

  test('US4-AS4 FR-017 SC-009 an outdated save keeps the input, says what changed, and saves again only when asked', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('idp-changed-elsewhere')
    await openProvider(page)
    await edit(page, 'LDAP')
    await page.locator('#idp-syncInterval').fill('45')
    await save(page)
    const notice = page.locator('[data-outdated]')
    await expect(notice).toContainText('Changed elsewhere')
    await expect(notice).toContainText('Bind Password')
    await expect(page.locator('#idp-syncInterval')).toHaveValue('45')
    expect(await requestsOf(mockApi, 'updateIdentityProvider')).toHaveLength(1)
    await expectAccessible()
    await page.getByRole('button', { name: 'Save again' }).click()
    await expect(section(page).getByRole('status')).toContainText(SAVED)
    const patches = await requestsOf(mockApi, 'updateIdentityProvider')
    expect(patches).toHaveLength(2)
    expect(patches[1]!.headers['if-match']).not.toBe(patches[0]!.headers['if-match'])
  })

  test('FR-016 leaving an edit with changes asks first', async ({ page, mockApi }) => {
    await mockApi.use('idp-ldap')
    await openProvider(page)
    await edit(page, 'LDAP')
    await page.locator('#idp-filter').fill('(objectClass=person)')
    await page.getByRole('link', { name: 'History' }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toContainText('Leave without saving?')
    await dialog.getByRole('button', { name: 'Stay' }).click()
    await expect(page.locator('#idp-filter')).toHaveValue('(objectClass=person)')
  })

  test('FR-018 the attribute field is required while synchronisation is on', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('idp-ldap')
    await openProvider(page)
    await edit(page, 'LDAP')
    await page.locator('#idp-attributeField').fill('')
    await page.getByRole('switch', { name: 'Periodic Full Sync' }).check()
    await save(page)
    await expect(page.locator('#idp-attributeField-error')).toContainText('This field is required.')
    expect(await requestsOf(mockApi, 'updateIdentityProvider')).toEqual([])
  })

  test('Edge: removed elsewhere: the save opens the empty form with an explanation', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('idp-removed-elsewhere')
    await openProvider(page)
    await edit(page, 'LDAP')
    await page.locator('#idp-syncInterval').fill('30')
    await save(page)
    await expect(page.locator('[data-page-status]')).toContainText(
      'No identity provider is configured.',
    )
    await expect(page.locator('[data-setup]')).toBeVisible()
    await expect(page).not.toHaveURL(/edit=provider/)
    await expectAccessible()
  })

  test('FR-013 another type is a whole save with If-Match and needs its secret', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('idp-keycloak')
    await openProvider(page)
    await edit(page, 'Keycloak')
    await page.locator('#idp-type').selectOption({ label: 'LDAP' })
    await page.locator('#idp-hosts').fill('ldap1.example.org')
    await page.locator('#idp-baseDn').fill('dc=example,dc=org')
    await page.locator('#idp-bindDn').fill('cn=admin,dc=example,dc=org')
    await save(page)
    await expect(page.locator('#idp-bindPassword-error')).toContainText(
      'Required: the provider type changes.',
    )
    await page.locator('#idp-bindPassword').fill('ldap-secret')
    await save(page)
    await expect(section(page).getByRole('heading', { level: 2, name: 'LDAP' })).toBeVisible()
    const [put] = await requestsOf(mockApi, 'saveIdentityProvider')
    expect(put!.status).toBe(200)
    expect(put!.headers['if-match']).toMatch(/^"idp/)
    expect(put!.body).toMatchObject({ type: 'ldap', bindPassword: 'ldap-secret' })
  })

  test('FR-014 FR-039 while mailboxes use another source, a type change and the removal are refused with the classic message', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('idp-other-source')
    await openProvider(page)
    await section(page).getByRole('button', { name: 'Remove' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete now' }).click()
    const refusal = 'The identity provider cannot be changed or deleted'
    await expect(section(page).getByRole('alert')).toContainText(refusal)
    await expect(section(page).getByRole('heading', { level: 2, name: 'LDAP' })).toBeVisible()
    await expectAccessible()

    await edit(page, 'LDAP')
    await page.locator('#idp-type').selectOption({ label: 'Keycloak' })
    await page.locator('#idp-serverUrl').fill('https://sso.example.org')
    await page.locator('#idp-realm').fill('example')
    await page.locator('#idp-clientId').fill('mailcow')
    await page.locator('#idp-clientSecret').fill('kc-secret')
    await page.locator('#idp-version').fill('26')
    await page.locator('#idp-legacyReturnUrl').fill('https://mail.example.org')
    await save(page)
    await expect(section(page).getByRole('alert').filter({ hasText: refusal })).toBeVisible()
    await expect(page.locator('#idp-serverUrl')).toHaveValue('https://sso.example.org')
  })

  test('US4-AS7 FR-039 removal: the classic confirmation, then the empty form and a refreshed sign-in configuration', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('idp-ldap')
    await openProvider(page)
    const before = (await requestsOf(mockApi, 'getPublicConfig')).length
    await section(page).getByRole('button', { name: 'Remove' }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toContainText('Confirm deletion')
    await expect(dialog).toContainText('LDAP')
    await expectAccessible()
    await dialog.getByRole('button', { name: 'Delete now' }).click()
    await expect(page.locator('[data-page-status]')).toContainText(/Item\s+successfully deleted/)
    await expect(page.locator('[data-setup]')).toBeVisible()
    const [removal] = await requestsOf(mockApi, 'deleteIdentityProvider')
    expect(removal!.headers['if-match']).toMatch(/^"idp/)
    await expect
      .poll(async () => (await requestsOf(mockApi, 'getPublicConfig')).length)
      .toBeGreaterThan(before)
    await expectAccessible()
  })

  test('A removal against an outdated version reloads and asks again', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('idp-changed-elsewhere')
    await openProvider(page)
    await section(page).getByRole('button', { name: 'Remove' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete now' }).click()
    const again = page.getByRole('alertdialog')
    await expect(again).toContainText('Confirm deletion')
    await again.getByRole('button', { name: 'Delete now' }).click()
    await expect(page.locator('[data-page-status]')).toContainText(/Item\s+successfully deleted/)
    expect(await requestsOf(mockApi, 'deleteIdentityProvider')).toHaveLength(2)
  })

  test('US6-AS1 History opens the audit log filtered to the configuration', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('idp-ldap')
    await openProvider(page)
    await page.getByRole('link', { name: 'History' }).click()
    await expect(page).toHaveURL(/\/ng\/audit-log\?targetType=identityProvider$/)
  })
})
