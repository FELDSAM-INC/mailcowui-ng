// UI 012 T045: the end of a single sign-on session (US2-AS8, FR-052) and the sign-out note
// (US2-AS9, FR-053).
import { signOutFromMenu } from '../fixtures/flows'
import { expect, test } from '../fixtures/test'

test.describe('the end of a single sign-on session', () => {
  test('US2-AS8 FR-052 the sign-in screen explains the end, offers single sign-on and returns to the page', async ({
    page,
    mockApi,
    fakeProvider,
    expectAccessible,
  }) => {
    await mockApi.use('sso-session-ends')
    const provider = await fakeProvider()
    await page.goto('passkeys')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await mockApi.patch({ singleSignOn: { endIdpSession: true } })
    await page.goto('passkeys')
    await expect(page).toHaveURL(/\/ng\/sign-in\?returnTo=%2Fpasskeys$/)
    await expect(page.locator('[data-notice]')).toContainText('single sign-on session has ended')
    await expect(page.getByRole('button', { name: 'Single Sign-On' })).toBeVisible()
    await expectAccessible()
    expect(provider.requests()).toEqual([])

    await mockApi.patch({ singleSignOn: { endIdpSession: false } })
    await page.getByRole('button', { name: 'Single Sign-On' }).click()
    await expect(page).toHaveURL(/\/ng\/passkeys$/)
  })

  test('US2-AS9 FR-053 signing out of a single sign-on session adds the provider note', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('sso-signed-in')
    await page.goto('')
    await signOutFromMenu(page)
    const notice = page.locator('[data-notice]')
    await expect(notice).toContainText('You have signed out of this app.')
    await expect(notice).toContainText("still signed in at your organisation's sign-in service")
    await expectAccessible()
  })

  test('FR-053 a password session signs out without the provider note', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('admin-active')
    await page.goto('')
    await signOutFromMenu(page)
    await expect(page.locator('[data-notice]')).toHaveText('You have signed out.')
  })
})
