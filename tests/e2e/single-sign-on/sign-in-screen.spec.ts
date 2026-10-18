// UI 012 T043: single sign-on on the sign-in screens (US2-AS1, US2-AS10, US2-AS11, FR-040 to
// FR-042, FR-044). The button sits where the classic login page has it: after the password form
// and "Forgot password?", below the classic "or login with" divider.
import type { Locator, Page } from '@playwright/test'

import { passwordForm } from '../fixtures/flows'
import { expect, test } from '../fixtures/test'

const ssoButton = (page: Page) => page.getByRole('button', { name: 'Single Sign-On' })
const passkeyButton = (page: Page) => page.getByRole('button', { name: 'Sign in with a passkey' })

async function follows(first: Locator, second: Locator): Promise<boolean> {
  const handle = await second.elementHandle()
  return first.evaluate(
    (a, b) => !!(a.compareDocumentPosition(b as Node) & Node.DOCUMENT_POSITION_FOLLOWING),
    handle,
  )
}

test.describe('single sign-on on the sign-in screens', () => {
  test('US2-AS1 FR-040 the role-neutral and mailbox-user screens offer it full width, the role screens do not', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
    expectTouchTargets,
  }) => {
    await mockApi.use('sso-available')
    for (const path of ['sign-in', 'sign-in/mailbox-user']) {
      await page.goto(path)
      const button = ssoButton(page)
      await expect(button).toBeVisible()
      const form = page.locator('form')
      const box = await button.boundingBox()
      const formBox = await form.boundingBox()
      expect(Math.round(box!.width)).toBe(Math.round(formBox!.width))
    }
    await expectAccessible()
    await expectNoHorizontalScroll()
    await expectTouchTargets()
    for (const path of ['sign-in/admin', 'sign-in/domain-admin']) {
      await page.goto(path)
      await expect(passwordForm(page).username).toBeVisible()
      await expect(ssoButton(page)).toHaveCount(0)
    }
  })

  test('US2-AS11 the order follows the classic login page: passkey, password form, "or login with", single sign-on', async ({
    page,
    mockApi,
    webauthn,
  }) => {
    await webauthn.stubCredentials('unused-credential')
    await mockApi.use('sso-available')
    await page.goto('sign-in')
    const divider = page.getByText('or login with', { exact: true })
    await expect(ssoButton(page)).toBeVisible()
    expect(await follows(passkeyButton(page), page.locator('form'))).toBe(true)
    expect(await follows(page.locator('form'), divider)).toBe(true)
    expect(await follows(divider, ssoButton(page))).toBe(true)
  })

  test('US2-AS11 without passkey support the password form comes first, then single sign-on', async ({
    page,
    mockApi,
    webauthn,
  }) => {
    await webauthn.withoutPasskeySupport()
    await mockApi.use('sso-available')
    await page.goto('sign-in')
    await expect(passkeyButton(page)).toHaveCount(0)
    expect(await follows(page.locator('form'), ssoButton(page))).toBe(true)
  })

  test('US2-AS10 FR-041 forced single sign-on keeps the passkey and the role links, without the form', async ({
    page,
    mockApi,
    webauthn,
    expectAccessible,
    expectNoHorizontalScroll,
  }) => {
    await webauthn.stubCredentials('unused-credential')
    await mockApi.use('sso-force')
    await page.goto('sign-in')
    await expect(ssoButton(page)).toBeVisible()
    await expect(passkeyButton(page)).toBeVisible()
    await expect(passwordForm(page).username).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Forgot Password?' })).toHaveCount(0)
    await expect(
      page.getByRole('navigation', { name: 'Not the correct login?' }).getByRole('link'),
    ).toHaveText(['Log in as admin', 'Log in as domain admin', 'Log in as user'])
    await expectAccessible()
    await expectNoHorizontalScroll()
    await page.goto('sign-in/admin')
    await expect(passwordForm(page).username).toBeVisible()
    await expect(ssoButton(page)).toHaveCount(0)
  })

  test('US2-AS10 FR-041 forced single sign-on without passkey support shows only single sign-on and the links', async ({
    page,
    mockApi,
    webauthn,
    expectAccessible,
  }) => {
    await webauthn.withoutPasskeySupport()
    await mockApi.use('sso-force')
    await page.goto('sign-in/mailbox-user')
    await expect(ssoButton(page)).toBeVisible()
    await expect(passkeyButton(page)).toHaveCount(0)
    await expect(passwordForm(page).username).toHaveCount(0)
    await expectAccessible()
  })

  test('FR-041 forced single sign-on is ignored while single sign-on is not offered', async ({
    page,
    mockApi,
  }) => {
    for (const scenario of ['sso-force-ldap', 'sso-force-none']) {
      await mockApi.use(scenario)
      await page.goto('sign-in')
      await expect(passwordForm(page).username).toBeVisible()
      await expect(ssoButton(page)).toHaveCount(0)
    }
  })

  test('FR-042 with an LDAP provider configured no "cannot use your password here" hint appears', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('ldap-password')
    for (const path of ['sign-in', 'sign-in/mailbox-user', 'sign-in/admin']) {
      await page.goto(path)
      await expect(passwordForm(page).username).toBeVisible()
      await expect(page.getByRole('note')).toHaveCount(0)
    }
  })

  test('FR-044 starting single sign-on never opens a second page', async ({
    page,
    context,
    mockApi,
    fakeProvider,
  }) => {
    await mockApi.use('sso-available')
    await fakeProvider({ mode: 'page' })
    await page.goto('sign-in')
    await ssoButton(page).click()
    await expect(page.getByRole('heading', { name: 'Example IdP' })).toBeVisible()
    expect(context.pages()).toHaveLength(1)
  })
})
