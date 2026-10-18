// UI 012 T044: the single sign-on round trip through the fake provider (US2-AS2 to US2-AS7,
// FR-043 to FR-049, FR-068, FR-080, SC-002, SC-011 and the edge cases): the start, the return page
// that strips the code and state before any request, every outcome, and the landing.
import type { Page } from '@playwright/test'

import { submitPassword } from '../fixtures/flows'
import { expect, test } from '../fixtures/test'

const ssoButton = (page: Page) => page.getByRole('button', { name: 'Single Sign-On' })
const outcome = (page: Page) => page.locator('[data-outcome]')
const tryAgain = (page: Page) => page.getByRole('button', { name: 'Try again' })
const backToSignIn = (page: Page) => page.getByRole('link', { name: 'Back to sign-in' })

const STATE_INVALID = 'The sign-in has expired or was already completed. Please start it again.'
const UNREACHABLE =
  "Your organisation's sign-in service cannot be reached. Please try again in a few minutes."
const CANCELLED = "The sign-in was cancelled or refused at your organisation's sign-in page."

/** Opens the sign-in screen (optionally through a protected page) and starts single sign-on. */
async function startFrom(page: Page, path = 'sign-in') {
  await page.goto(path)
  await ssoButton(page).click()
}

test.describe('the single sign-on round trip', () => {
  test('US2-AS2 FR-043 a tap shows a busy state and opens the provider once, in the same tab', async ({
    page,
    mockApi,
    fakeProvider,
  }) => {
    await mockApi.use('sso-available')
    await fakeProvider({ mode: 'page' })
    await mockApi.delay('startSingleSignOn', 1500)
    await page.goto('sign-in')
    await ssoButton(page).click()
    await expect(ssoButton(page)).toBeDisabled()
    await expect(ssoButton(page)).toHaveAttribute('aria-busy', 'true')
    await expect(page.getByRole('heading', { name: 'Example IdP' })).toBeVisible()
    const starts = (await mockApi.requests()).filter((r) => r.operationId === 'startSingleSignOn')
    expect(starts).toHaveLength(1)
  })

  test('US2-AS3 FR-045 FR-046 FR-047 FR-080 SC-011 the return strips the address, completes once and lands on the requested page', async ({
    page,
    mockApi,
    fakeProvider,
    expectAccessible,
    expectNoHorizontalScroll,
  }) => {
    test.slow()
    await mockApi.use('sso-available')
    const provider = await fakeProvider()
    await mockApi.delay('completeSingleSignOn', 6000)
    await page.goto('passkeys')
    await expect(page).toHaveURL(/\/ng\/sign-in\?returnTo=%2Fpasskeys$/)
    await ssoButton(page).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Single Sign-On' })).toBeVisible()
    await expect(page).toHaveURL(/\/ng\/sso\/return$/)
    await expect(page.getByRole('status').filter({ hasText: 'Completing sign-in' })).toBeVisible()
    await expectAccessible()
    await expectNoHorizontalScroll()
    await expect(page).toHaveURL(/\/ng\/passkeys$/, { timeout: 15_000 })
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    const [state] = provider.states()
    const [code] = provider.codes()
    const requests = await mockApi.requests()
    const completions = requests.filter((r) => r.operationId === 'completeSingleSignOn')
    expect(completions).toHaveLength(1)
    expect(completions[0]!.body).toMatchObject({ state })
    for (const request of requests) {
      expect(request.path).not.toContain(code!)
      expect(request.path).not.toContain(state!)
      expect(request.headers.referer ?? '').not.toContain(code!)
      expect(request.headers.referer ?? '').not.toContain(state!)
      if (request.operationId !== 'completeSingleSignOn') {
        expect(JSON.stringify(request.body ?? null)).not.toContain(state!)
      }
    }
    // The provider was reached only by navigation, never by a request of the app (FR-080).
    expect(provider.requests().every((r) => r.resourceType === 'document')).toBe(true)
  })

  test('SC-002 from the return page to the landing takes under 3 seconds', async ({
    page,
    mockApi,
    fakeProvider,
  }) => {
    await mockApi.use('sso-available')
    await fakeProvider()
    let returnedAt = 0
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame() && frame.url().includes('/ng/sso/return') && !returnedAt) {
        returnedAt = Date.now()
      }
    })
    await startFrom(page)
    await expect(page).toHaveURL(/\/ng\/$/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    expect(returnedAt).toBeGreaterThan(0)
    expect(Date.now() - returnedAt).toBeLessThan(3000)
  })

  test('SC-011 with site storage blocked the landing is home', async ({
    page,
    mockApi,
    fakeProvider,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'sessionStorage', {
        configurable: true,
        get() {
          throw new DOMException('The operation is insecure.', 'SecurityError')
        },
      })
    })
    await mockApi.use('sso-available')
    await fakeProvider()
    await startFrom(page, 'passkeys')
    await expect(page).toHaveURL(/\/ng\/$/)
  })

  test('US2-AS4 a foreign state says the sign-in expired; "Try again" starts anew without resending the old code', async ({
    page,
    mockApi,
    fakeProvider,
    expectAccessible,
  }) => {
    await mockApi.use('sso-available')
    const provider = await fakeProvider()
    await page.goto('sso/return?code=old-code&state=foreign-state')
    await expect(outcome(page)).toContainText(STATE_INVALID)
    await expect(page).toHaveURL(/\/ng\/sso\/return$/)
    await expectAccessible()
    await tryAgain(page).click()
    await expect(page).toHaveURL(/\/ng\/$/)
    const completions = (await mockApi.requests()).filter(
      (r) => r.operationId === 'completeSingleSignOn',
    )
    expect(completions.map((r) => (r.body as { state: string }).state)).toEqual([
      'foreign-state',
      provider.states()[0],
    ])
  })

  test('US2-AS5 FR-048 a provider error is reported with its code and state only and shown as cancelled', async ({
    page,
    mockApi,
    fakeProvider,
    expectAccessible,
    expectNoHorizontalScroll,
  }) => {
    await mockApi.use('sso-available')
    const provider = await fakeProvider({
      answer: { kind: 'error', error: 'access_denied', description: 'The user said no thanks' },
    })
    await startFrom(page)
    await expect(outcome(page)).toContainText(CANCELLED)
    await expect(page.getByText('said no thanks')).toHaveCount(0)
    await expect(tryAgain(page)).toBeVisible()
    await expect(backToSignIn(page)).toBeVisible()
    await expectAccessible()
    await expectNoHorizontalScroll()
    const requests = await mockApi.requests()
    const report = requests.find((r) => r.operationId === 'reportSingleSignOnProviderError')
    expect(report?.body).toEqual({ error: 'access_denied', state: provider.states()[0] })
    expect(requests.some((r) => r.operationId === 'cancelSingleSignOn')).toBe(false)
  })

  test('FR-048 an error code with a quote, or an error without a state, cancels the pending sign-in instead', async ({
    page,
    mockApi,
    fakeProvider,
  }) => {
    await mockApi.use('sso-available')
    const provider = await fakeProvider({ answer: { kind: 'error', error: 'bad"code' } })
    await startFrom(page)
    await expect(outcome(page)).toContainText(CANCELLED)
    provider.answer({ kind: 'error', error: 'access_denied', withoutState: true })
    await startFrom(page)
    await expect(outcome(page)).toContainText(CANCELLED)
    const ops = (await mockApi.requests()).map((r) => r.operationId)
    expect(ops.filter((op) => op === 'cancelSingleSignOn')).toHaveLength(2)
    expect(ops).not.toContain('reportSingleSignOnProviderError')
  })

  test('FR-048 a code without a state cancels and says the sign-in expired', async ({
    page,
    mockApi,
    fakeProvider,
  }) => {
    await mockApi.use('sso-available')
    await fakeProvider({ answer: { kind: 'codeOnly' } })
    await startFrom(page)
    await expect(outcome(page)).toContainText(STATE_INVALID)
    const ops = (await mockApi.requests()).map((r) => r.operationId)
    expect(ops).toContain('cancelSingleSignOn')
    expect(ops).not.toContain('completeSingleSignOn')
  })

  test('US2-AS6 FR-068 a refused completion shows one generic message and no reason', async ({
    page,
    mockApi,
    fakeProvider,
    expectAccessible,
  }) => {
    await mockApi.use('sso-refused')
    await fakeProvider()
    await startFrom(page)
    await expect(outcome(page)).toContainText('Login failed')
    await expect(page.getByText('HTTP 401')).toHaveCount(0)
    await expect(tryAgain(page)).toBeVisible()
    await expectAccessible()
  })

  test('US2-AS7 FR-068 an unreachable provider says so, with "Try again"', async ({
    page,
    mockApi,
    fakeProvider,
  }) => {
    await mockApi.use('sso-provider-down')
    await fakeProvider()
    await startFrom(page)
    await expect(outcome(page)).toContainText(UNREACHABLE)
    await expect(page.getByText('HTTP 503')).toHaveCount(0)
    await expect(tryAgain(page)).toBeVisible()
  })

  test('FR-048 single sign-on switched off during the round trip: "not offered", only "Back to sign-in", the action gone', async ({
    page,
    mockApi,
    fakeProvider,
  }) => {
    await mockApi.use('sso-disabled-after-start')
    await fakeProvider({ mode: 'page' })
    await startFrom(page)
    await expect(page.getByRole('heading', { name: 'Example IdP' })).toBeVisible()
    await mockApi.patch({
      publicConfig: {
        externalIdentityProvider: { configured: true, singleSignOnAvailable: false },
      },
    })
    await page.getByRole('link', { name: 'Approve' }).click()
    await expect(outcome(page)).toContainText('Single sign-on is not offered on this server.')
    await expect(tryAgain(page)).toHaveCount(0)
    await backToSignIn(page).click()
    await expect(page).toHaveURL(/\/ng\/sign-in$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Login' })).toBeVisible()
    await expect(ssoButton(page)).toHaveCount(0)
  })

  test('Edge: single sign-on becomes unavailable before tapping: a message, the configuration refetched, the action hidden', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('sso-not-available-on-start')
    await page.goto('sign-in')
    await expect(ssoButton(page)).toBeVisible()
    await mockApi.patch({
      publicConfig: {
        externalIdentityProvider: { configured: true, singleSignOnAvailable: false },
      },
    })
    await ssoButton(page).click()
    await expect(page.getByText('Single sign-on is not offered on this server.')).toBeVisible()
    await expect(ssoButton(page)).toHaveCount(0)
    const configs = (await mockApi.requests()).filter((r) => r.operationId === 'getPublicConfig')
    expect(configs.length).toBeGreaterThanOrEqual(2)
  })

  test('FR-049 Edge: after a reload of the return page no parameters remain and the sign-in screen opens without an error', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('sso-available')
    await page.goto('sso/return?code=old-code&state=foreign-state')
    await expect(outcome(page)).toBeVisible()
    await page.reload()
    await expect(page).toHaveURL(/\/ng\/sign-in$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Login' })).toBeVisible()
    await expect(page.getByRole('alert')).toHaveCount(0)
  })

  test('FR-049 the return page without parameters opens the app for an active session', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('sso-signed-in')
    await page.goto('sso/return')
    await expect(page).toHaveURL(/\/ng\/$/)
  })

  test('Edge: Browser Back from the provider leaves every sign-in action usable', async ({
    page,
    mockApi,
    fakeProvider,
  }) => {
    await mockApi.use('sso-available')
    await fakeProvider({ mode: 'page' })
    await startFrom(page)
    await expect(page.getByRole('heading', { name: 'Example IdP' })).toBeVisible()
    await page.goBack()
    await expect(ssoButton(page)).toBeEnabled()
    await expect(ssoButton(page)).not.toHaveAttribute('aria-busy', 'true')
    await expect(page.getByLabel('Username', { exact: true })).toBeEditable()
  })

  test('"Back to sign-in" keeps the requested page', async ({ page, mockApi, fakeProvider }) => {
    await mockApi.use('sso-refused')
    await fakeProvider()
    await startFrom(page, 'passkeys')
    await expect(outcome(page)).toBeVisible()
    await backToSignIn(page).click()
    await expect(page).toHaveURL(/\/ng\/sign-in\?returnTo=%2Fpasskeys$/)
  })

  test('FR-047 a mailbox created at the first sign-in lands like an existing one', async ({
    page,
    mockApi,
    fakeProvider,
  }) => {
    await mockApi.use('sso-auto-create')
    await fakeProvider()
    await startFrom(page)
    await expect(page).toHaveURL(/\/ng\/$/)
    await expect(
      page.getByRole('button', { name: /Account menu of new\.user@example\.org/ }),
    ).toBeVisible()
  })

  test('Edge: another account signs in in a second tab during the round trip; the current session is shown after it', async ({
    page,
    context,
    mockApi,
    fakeProvider,
  }) => {
    await mockApi.use('sso-available', { accounts: { 'alice@example.org': { secondFactors: [] } } })
    await fakeProvider({ mode: 'page' })
    await startFrom(page)
    await expect(page.getByRole('heading', { name: 'Example IdP' })).toBeVisible()
    const other = await context.newPage()
    await other.goto('sign-in')
    await submitPassword(other, 'alice@example.org')
    await expect(other).toHaveURL(/\/ng\/$/)
    await page.getByRole('link', { name: 'Approve' }).click()
    await expect(page).toHaveURL(/\/ng\/$/)
    await expect(
      page.getByRole('button', { name: /Account menu of anna@example\.org/ }),
    ).toBeVisible()
    await other.close()
  })
})
