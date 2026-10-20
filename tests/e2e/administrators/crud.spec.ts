import { expect, test } from '../fixtures/test'

test.afterEach(async ({ expectAccessible, expectNoHorizontalScroll, expectTouchTargets }, info) => {
  if (info.status !== info.expectedStatus) return
  await expectAccessible()
  await expectNoHorizontalScroll()
  if (info.project.name.startsWith('mobile-')) await expectTouchTargets()
})

for (const role of ['admin', 'domainAdmin'] as const) {
  const path = role === 'admin' ? 'admins' : 'domain-admins'
  test(`${role} list, sort, back restoration and responsive layout`, async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
  }) => {
    await mockApi.use(role === 'admin' ? 'admins-three' : 'domain-admins-three')
    await page.goto(`administrators/${path}?sort=active&order=desc`)
    await expect(page.locator('[data-account-row]')).toHaveCount(3)
    await expect(page.locator('[data-account-sort]')).toHaveValue('active')
    await expectAccessible()
    await expectNoHorizontalScroll()
    await page.locator('[data-account-row]').first().getByRole('link').first().click()
    await expect(page.locator('#section-account')).toBeVisible()
    await page.goBack()
    await expect(page).toHaveURL(/sort=active&order=desc/)
    await expect(page.locator('[data-account-sort]')).toHaveValue('active')
  })
  test(`${role} creates with a generated password, edits, renames and removes`, async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
    expectTouchTargets,
  }) => {
    await mockApi.use(role === 'admin' ? 'admins-three' : 'domain-admins-three')
    await page.goto(`administrators/${path}/-/new`)
    await page.locator('input[name="accountUsername"]').fill(`browser-${path}`)
    if (role === 'domainAdmin') {
      await page.getByRole('combobox', { name: /Domain assignments/ }).fill('example.org')
      await page.getByRole('option', { name: 'example.org', exact: true }).click()
    }
    await page.locator('[data-generate]').click()
    await expect(page.locator('input[autocomplete="new-password"]').first()).not.toHaveValue('')
    await expectAccessible()
    await expectNoHorizontalScroll()
    await expectTouchTargets()
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/administrators/${path}/browser-${path}$`))
    await expect(page.locator('input[autocomplete="new-password"]')).toHaveCount(0)
    await page
      .locator('#section-account')
      .getByRole('button', { name: /^Edit / })
      .click()
    await page.locator('input[name="accountUsername"]').fill(`renamed-${path}`)
    await expectTouchTargets()
    await page
      .locator('#section-account')
      .getByRole('button', { name: 'Save changes', exact: true })
      .click()
    await expect(page.getByRole('alertdialog')).toContainText('API keys')
    await expectAccessible()
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Save changes', exact: true })
      .click()
    await expect(page).toHaveURL(new RegExp(`/administrators/${path}/renamed-${path}$`))
    await page.getByRole('button', { name: `Actions for renamed-${path}` }).click()
    await page.getByRole('menuitem', { name: 'Remove', exact: true }).click()
    await expect(page.getByRole('alertdialog')).toContainText('Domains and mailboxes remain')
    await expectAccessible()
    await page.getByRole('button', { name: 'Delete now', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/administrators/${path}$`))
    await expect(page.locator('[data-account-row]')).toHaveCount(3)
  })
}
test('ACL conflict retains the draft and only resends intended flags', async ({
  page,
  mockApi,
  expectAccessible,
  expectTouchTargets,
}) => {
  await mockApi.use('domain-admins-three')
  await page.goto('administrators/domain-admins/reseller?edit=permissions')
  await page.locator('#account-permission-loginAs').click()
  await mockApi.changeElsewhere({ domainAdmin: { reseller: { forcePasswordChange: true } } })
  await page
    .locator('#section-permissions')
    .getByRole('button', { name: 'Save changes', exact: true })
    .click()
  await expect(page.locator('[data-outdated]')).toBeVisible()
  // Measure the complete page from its top, with no unrelated target clipped by the sticky header.
  await page.evaluate(() => window.scrollTo(0, 0))
  await expect(page.locator('#account-permission-loginAs')).toBeChecked()
  await expectAccessible()
  await expectTouchTargets()
  expect(
    (await mockApi.requests()).filter((request) => request.operationId === 'updateDomainAdmin'),
  ).toHaveLength(1)
  await page.getByRole('button', { name: 'Save again', exact: true }).click()
  await expect(page).not.toHaveURL(/edit=/)
  const writes = (await mockApi.requests()).filter(
    (request) => request.operationId === 'updateDomainAdmin',
  )
  expect(writes).toHaveLength(2)
  expect(writes[1]!.body).toEqual({ permissions: { loginAs: true } })
  expect(writes[0]!.headers['if-match']).not.toBe(writes[1]!.headers['if-match'])
})
test('password draft survives conflict and can be discarded without a second write', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('domain-admins-three')
  await page.goto('administrators/domain-admins/reseller?edit=account')
  await page.locator('[data-generate]').click()
  const password = await page.locator('input[autocomplete="new-password"]').first().inputValue()
  await mockApi.changeElsewhere({ domainAdmin: { reseller: { forceSecondFactorSetup: true } } })
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.locator('[data-outdated]')).toBeVisible()
  await expect(page.locator('input[autocomplete="new-password"]').first()).toHaveValue(password)
  await page.getByRole('button', { name: 'Discard my changes', exact: true }).click()
  await expect(page.locator('input[autocomplete="new-password"]').first()).toHaveValue('')
  await expect(page.locator('#account-edit-forceSecondFactorSetup')).toBeChecked()
  expect(
    (await mockApi.requests()).filter((request) => request.operationId === 'updateDomainAdmin'),
  ).toHaveLength(1)
})
test('last active administrator cannot be deactivated or removed', async ({ page, mockApi }) => {
  await mockApi.use('admins-one')
  await page.goto('administrators/admins/admin?edit=account')
  await expect(page.locator('#account-edit-active')).toBeDisabled()
  await expect(page.locator('#account-edit-active-reason')).toHaveText(
    'Cannot deactivate last active admin',
  )
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.getByRole('button', { name: 'Actions for admin' }).click()
  await expect(page.getByRole('menuitem', { name: /Remove/ })).toHaveAttribute('data-disabled', '')
  expect(
    (await mockApi.requests()).filter((request) =>
      ['updateAdmin', 'deleteAdmin'].includes(request.operationId ?? ''),
    ),
  ).toHaveLength(0)
})
test('self rename clears old identity state and self deactivation explains sign-out', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('admins-three')
  await page.goto('administrators/admins/admin?edit=account')
  await page.locator('input[name="accountUsername"]').fill('renamed-admin')
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.getByRole('alertdialog')).toContainText('This browser stays signed in')
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Save changes', exact: true })
    .click()
  await expect(page).toHaveURL(/administrators\/admins\/renamed-admin$/)
  await expect(page.locator('h1')).toBeFocused()
  await page
    .locator('#section-account')
    .getByRole('button', { name: /^Edit / })
    .click()
  await page.locator('#account-edit-active').click()
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.getByRole('alertdialog')).toContainText('This browser will be signed out')
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Deactivate', exact: true })
    .click()
  await expect(page.locator('[data-notice]')).toContainText('Your account was deactivated')
})
test('bulk removal excludes own account and requires the actual count', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('admins-three')
  await page.goto('administrators/admins')
  await page.getByRole('button', { name: 'Select', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Select admin', exact: true }).check()
  await page.getByRole('checkbox', { name: 'Select operator', exact: true }).check()
  await page.locator('[data-bulk-bar]').getByRole('button', { name: 'Remove', exact: true }).click()
  await expect(page.getByRole('alertdialog')).toContainText('Remove 1 accounts')
  await expect(page.getByRole('button', { name: 'Delete now', exact: true })).toBeDisabled()
  await page.getByRole('alertdialog').getByRole('textbox').fill('1')
  await page.getByRole('button', { name: 'Delete now', exact: true }).click()
  await expect(page.locator('[data-account-row]')).toHaveCount(2)
  const request = (await mockApi.requests()).find(
    (entry) => entry.operationId === 'applyAdminBulkAction',
  )!
  expect(request.body).toMatchObject({ action: 'delete', targets: [{ id: 'operator' }] })
  await expect(page.getByRole('main')).toContainText('Your own account was left out')
})
test('domain administrators cannot open account-management routes', async ({ page, mockApi }) => {
  await mockApi.use('domain-admins-as-domain-admin')
  await page.goto('administrators/domain-admins')
  await expect(page.getByRole('heading', { name: 'No access', exact: true })).toBeVisible()
  expect(
    (await mockApi.requests()).some((request) => request.operationId === 'listDomainAdmins'),
  ).toBe(false)
})
test('missing account and failed list show recoverable states', async ({ page, mockApi }) => {
  await mockApi.use('domain-admins-three')
  await page.goto('administrators/domain-admins/missing')
  await expect(page.getByRole('heading', { name: 'Page not found', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Back to accounts', exact: true })).toBeVisible()
  await mockApi.failNext('listDomainAdmins', { status: 500 })
  await page.goto('administrators/domain-admins')
  await expect(page.getByRole('button', { name: 'Try again', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(page.locator('[data-account-row]')).toHaveCount(3)
})

test('FR-024 suspends second factors while retaining passkeys', async ({ page, mockApi }) => {
  await mockApi.use('domain-admins-three')
  await page.goto('administrators/domain-admins/team')
  await expect(page.getByRole('main')).toContainText('2 active passkeys')
  await page.getByRole('button', { name: 'Actions for team' }).click()
  await page
    .getByRole('menuitem', { name: 'Disable TFA until next successful login', exact: true })
    .click()
  await expect(page.getByRole('alertdialog')).toContainText('Passkeys remain available')
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Disable TFA until next successful login', exact: true })
    .click()
  await expect(page.getByRole('main')).toContainText('Suspended until next sign-in')
  await expect(page.getByRole('main')).toContainText('2 active passkeys')
  const request = (await mockApi.requests()).find(
    (entry) => entry.operationId === 'suspendDomainAdminSecondFactors',
  )!
  expect(request.headers['if-match']).toBeTruthy()
})
