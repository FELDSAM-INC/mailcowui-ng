import { expect, test } from '../../fixtures/test'
import { signOutFromMenu } from '../../fixtures/flows'

test('T078 preserves legacy help and publishes hidden login links without reloading', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('idp-none')
  await page.goto('system/customize/login-page')
  const links = page.locator('#section-sign-in-links')
  await expect(links).toContainText(
    'Show or hide quick links to other login pages under the login form',
  )
  await links.getByRole('button', { name: /^Edit / }).click()
  const fields = links.locator('input[type=checkbox]')
  expect(await fields.evaluateAll((inputs) => inputs.map((input) => input.id))).toEqual([
    'login-page-hideMailboxUserLogin',
    'login-page-hideDomainAdminLogin',
    'login-page-hideAdminLogin',
  ])
  await page.locator('#login-page-hideAdminLogin').check()
  await expectAccessible()
  await links.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(links.locator('form')).toHaveCount(0)
  const writes = (await mockApi.requests()).filter(
    (request) => request.operationId === 'updateLoginPageSettings',
  )
  expect(writes).toHaveLength(1)
  expect(writes[0]!.body).toEqual({ hideAdminLogin: true })
  await signOutFromMenu(page)
  await expect(
    page.getByRole('link', { name: 'Log in as domain admin', exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('link', { name: 'Log in as admin', exact: true })).toHaveCount(0)
})

test('T078 force SSO explains missing provider and uses the existing identity-provider destination', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('idp-none')
  await page.goto('system/customize/login-page')
  await expect(page.locator('[data-no-sso]')).toContainText(
    'no effect until single sign-on is configured',
  )
  await expect(page.locator('[data-no-sso] a')).toHaveAttribute('href', '/ng/identity-providers')
  const sso = page.locator('#section-single-sign-on')
  await expect(sso).toContainText('If an external OIDC provider is configured')
  await sso.getByRole('button', { name: /^Edit / }).click()
  await page.locator('#login-page-forceSingleSignOn').check()
  await sso.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(sso.locator('form')).toHaveCount(0)
  await expectAccessible()
  await expectNoHorizontalScroll(page, { widths: [320, 360] })
})

test('T078 an available provider removes the no-effect note and demo remains readable', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('idp-sso-available')
  await page.goto('system/customize/login-page')
  await expect(page.locator('#section-single-sign-on')).toBeVisible()
  await expect(page.locator('[data-no-sso]')).toHaveCount(0)
  await mockApi.use('settings-demo-mode')
  await page.reload()
  await expect(page.locator('[data-demo-mode]')).toBeVisible()
  await expect(page.locator('main').getByRole('button', { name: /^Edit / })).toHaveCount(0)
  await expect(page.locator('main input')).toHaveCount(0)
  await expectAccessible()
})

test('T078 stale login flags keep the draft and need explicit retry', async ({
  page,
  context,
  mockApi,
}) => {
  await mockApi.use('idp-none')
  await page.goto('system/customize/login-page')
  const links = page.locator('#section-sign-in-links')
  await links.getByRole('button', { name: /^Edit / }).click()
  await page.locator('#login-page-hideAdminLogin').check()
  const other = await context.newPage()
  await other.goto('system/customize/login-page')
  await other
    .locator('#section-sign-in-links')
    .getByRole('button', { name: /^Edit / })
    .click()
  await other.locator('#login-page-hideDomainAdminLogin').check()
  await other
    .locator('#section-sign-in-links')
    .getByRole('button', { name: 'Save changes', exact: true })
    .click()
  await expect(other.locator('#section-sign-in-links form')).toHaveCount(0)
  await other.close()
  await links.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(links.locator('[data-outdated]')).toBeVisible()
  await expect(page.locator('#login-page-hideAdminLogin')).toBeChecked()
  expect(await mockApi.countRequests('updateLoginPageSettings')).toBe(2)
  await links.getByRole('button', { name: 'Save again', exact: true }).click()
  await expect(links.locator('form')).toHaveCount(0)
  const writes = (await mockApi.requests()).filter(
    (request) => request.operationId === 'updateLoginPageSettings',
  )
  expect(writes[2]!.body).toEqual({ hideAdminLogin: true })
  expect(writes[2]!.headers['if-match']).not.toBe(writes[1]!.headers['if-match'])
})
