// UI 009 US4, the connection test of a relayhost or transport (T068): legacy's test form on its
// own page (the "To:" address prefilled with the server's default, as legacy prefills it), the
// running state, the verdict-first summary for every outcome, the transcript readable on a phone
// with its copy action, the watchdog, and leaving while a test runs.
import { expect, test } from '../fixtures/test'
import { isNarrow, polite } from './helpers'

const STEPS = [
  ['resolve', 'Name resolution', 11],
  ['connect', 'Connection', 12],
  ['greeting', 'Greeting', 13],
  ['tls', 'TLS', 14],
  ['login', 'Login', 15],
  ['sender', 'Sender', 16],
  ['recipient', 'Recipient', 17],
  ['message', 'Message', 18],
] as const

test.describe('connection test', () => {
  test('US4-AS1 FR-044 legacy’s test form with the server defaults', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
  }) => {
    await mockApi.use('routing-tests')
    await page.goto('routing/relayhosts')
    await clickRowAction(page, page.locator('[data-entry="1"]'), /^Test:/)
    await expect(page).toHaveURL(/routing\/relayhosts\/1\/test$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Transport' })).toBeVisible()
    await expect(page.getByText('[smtp.example.net]:587')).toBeVisible()
    const sender = page.getByLabel('"From:" address')
    await expect(sender).toHaveValue('')
    await expect(sender).toHaveAttribute('placeholder', 'relay@example.org')
    const recipient = page.getByLabel('"To:" address')
    await expect(recipient).toHaveValue('null@hosted.mailcow.de')
    await expect(page.getByText('to test relaying to a foreign destination')).toBeVisible()
    await expectAccessible()
    await expectNoHorizontalScroll()
  })

  test('US4-AS2 US4-AS3 FR-045 FR-046 runs once, then shows the accepted summary above the transcript', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('routing-tests')
    await mockApi.delay('testRelayhostConnection', 800)
    await page.goto('routing/relayhosts/1/test')
    const run = page.getByRole('button', { name: /Run test|Please wait/ })
    await run.click()
    await expect(page.getByRole('button', { name: 'Please wait...' })).toBeDisabled()
    await expect(polite(page)).toContainText('Please wait...')
    const summary = page.getByRole('region', { name: 'Test result' })
    await expect(summary.getByRole('heading', { name: 'Accepted' })).toBeVisible()
    await expect(summary.getByRole('heading', { name: 'Accepted' })).toBeFocused()
    await expect(summary).toContainText('Reached: Message')
    await expect(summary).toContainText('Used (STARTTLS)')
    await expect(summary).toContainText('Succeeded')
    await expect(summary).toContainText('smtp.example.net:587')
    await expect(summary).toContainText('250 2.0.0 Ok: queued')
    await expect(polite(page)).toContainText('Accepted')
    const requests = (await mockApi.requests()).filter(
      (item) => item.operationId === 'testRelayhostConnection',
    )
    expect(requests).toHaveLength(1)
    expect(requests[0]!.body).toEqual({ recipient: 'null@hosted.mailcow.de' })
    await expectAccessible()
  })

  test('US4-AS4 SC-004 every failed step shows the verdict and the step on the first screen', async ({
    page,
    mockApi,
  }) => {
    test.skip(!isNarrow(page), 'SC-004 is measured at 360 × 780')
    await mockApi.use('routing-tests')
    for (const [, label, id] of STEPS) {
      await page.goto(`routing/transports/${id}/test`)
      await page.getByRole('button', { name: 'Run test' }).click()
      const verdict = page.getByRole('heading', { name: 'Not accepted' })
      await expect(verdict).toBeInViewport()
      await expect(verdict).toBeFocused()
      await expect(page.getByText(`Failed at: ${label}`)).toBeInViewport()
    }
    await expect(page.getByText('554 5.7.1 Spam').first()).toBeVisible()
  })

  test('a pending result preserves focus and scroll after the user leaves the form', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('routing-tests')
    let release!: () => void
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    let received!: () => void
    const ready = new Promise<void>((resolve) => {
      received = resolve
    })
    await page.route('**/relayhosts/1/connection-test', async (route) => {
      const response = await route.fetch()
      received()
      await held
      await route.fulfill({ response })
    })
    try {
      await page.goto('routing/relayhosts/1/test')
      await page.getByRole('button', { name: 'Run test' }).click()
      await ready
      const previous = page.getByRole('link', { name: 'Previous page', exact: true })
      await previous.focus()
      await expect(previous).toBeFocused()
      const scroll = await page.evaluate(() => window.scrollY)
      release()
      await expect(page.getByRole('heading', { name: 'Accepted', exact: true })).toBeVisible()
      await expect(previous).toBeFocused()
      expect(await page.evaluate(() => window.scrollY)).toBe(scroll)
    } finally {
      release()
    }
  })

  test('US4-AS4 the login failure names the step and the server’s reply', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('routing-tests')
    await page.goto('routing/transports/15/test')
    await page.getByRole('button', { name: 'Run test' }).click()
    const summary = page.getByRole('region', { name: 'Test result' })
    await expect(summary).toContainText('Not accepted')
    await expect(summary).toContainText('Failed at: Login')
    await expect(summary).toContainText('The server rejected it.')
    await expect(summary).toContainText('535 5.7.8 Authentication credentials invalid')
  })

  test('US4-AS5 an MX lookup names the mail exchanger', async ({ page, mockApi }) => {
    await mockApi.use('routing-tests')
    await page.goto('routing/transports/19/test')
    await page.getByRole('button', { name: 'Run test' }).click()
    await expect(page.getByRole('region', { name: 'Test result' })).toContainText(
      'mx1.partner.net:25 (MX lookup of partner.net)',
    )
  })

  test('US4-AS6 an invalid sender is refused at the field and no test runs', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('routing-tests')
    await page.goto('routing/transports/19/test')
    await page.getByLabel('"From:" address').fill('not-an-address')
    await page.getByRole('button', { name: 'Run test' }).click()
    await expect(page.locator('#connection-test-sender-error')).toContainText(
      'Enter a valid email address.',
    )
    const requests = await mockApi.requests()
    expect(requests.some((item) => item.operationId === 'testTransportConnection')).toBe(false)
  })

  test('US4-AS7 FR-047 FR-074 the transcript wraps, keeps markers and redactions, is text and can be copied', async ({
    page,
    mockApi,
    context,
    browserName,
    expectNoHorizontalScroll,
  }) => {
    // WebKit knows no clipboard permissions: there the copy either works or is refused with the
    // transcript selected for copying by hand.
    if (browserName === 'chromium')
      await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await mockApi.use('routing-tests')
    await page.goto('routing/relayhosts/1/test')
    await page.getByRole('button', { name: 'Run test' }).click()
    const toggle = page.getByRole('button', { name: /Transcript/ })
    if (isNarrow(page)) {
      await expect(toggle).toHaveAttribute('aria-expanded', 'false')
      await toggle.click()
    }
    const transcript = page.locator('[data-transcript]')
    await expect(transcript).toContainText('AUTH PLAIN [redacted]')
    await expect(transcript).toContainText('C:')
    await expect(transcript).toContainText('S:')
    await expectNoHorizontalScroll()
    await page.getByRole('button', { name: 'Copy transcript' }).click()
    if (browserName === 'chromium') {
      await expect(polite(page)).toContainText('Copied to the clipboard.')
      expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
        'C: AUTH PLAIN [redacted]',
      )
    } else {
      const outcome = /Copied to the clipboard\.|The browser did not allow copying\./
      await expect(page.locator('[data-live]').filter({ hasText: outcome })).toHaveCount(1)
    }
    await page.goto('routing/transports/20/test')
    await page.getByRole('button', { name: 'Run test' }).click()
    if (isNarrow(page)) await page.getByRole('button', { name: /Transcript/ }).click()
    await expect(page.locator('[data-transcript]')).toContainText('<b>not markup</b>')
    await page.goto('routing/transports/21/test')
    await page.getByRole('button', { name: 'Run test' }).click()
    if (isNarrow(page)) await page.getByRole('button', { name: /Transcript/ }).click()
    await expect(page.locator('[data-transcript] li')).toHaveCount(501)
    await expectNoHorizontalScroll()
  })

  test('FR-045 Edge: a test that never answers ends after the server timeout plus 15 s', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('routing-tests', {
      routing: {
        capabilities: {
          administration: {
            connectionTest: {
              defaultSender: 'relay@example.org',
              defaultRecipient: 'null@hosted.mailcow.de',
              stepTimeoutSeconds: 1,
              totalTimeoutSeconds: 1,
            },
          },
        },
      },
    })
    await page.clock.install()
    await page.goto('routing/transports/22/test')
    // The watchdog takes the server's time limits from the capabilities, read with the page.
    await expect(page.getByLabel('"From:" address')).toHaveAttribute(
      'placeholder',
      'relay@example.org',
    )
    await page.getByRole('button', { name: 'Run test' }).click()
    await expect(page.getByRole('button', { name: 'Please wait...' })).toBeDisabled()
    await page.clock.runFor(16_500)
    await expect(page.getByRole('alert')).toContainText(
      'No result was received. The test may still have sent a message.',
    )
    await expect(page.getByRole('button', { name: 'Run test' })).toBeEnabled()
  })

  test('Edge: leaving while a test runs leaves nothing behind', async ({ page, mockApi }) => {
    await mockApi.use('routing-tests')
    await page.goto('routing/transports/22/test')
    await page.getByRole('button', { name: 'Run test' }).click()
    await page.goto('routing/transports')
    await page.goto('routing/transports/22/test')
    await expect(page.getByRole('button', { name: 'Run test' })).toBeEnabled()
    await expect(page.getByRole('region', { name: 'Test result' })).toHaveCount(0)
  })

  test('FR-043 every relayhost and transport offers the test', async ({ page, mockApi }) => {
    await mockApi.use('routing-tests')
    await page.goto('routing/transports')
    await expect(await rowAction(page, page.locator('[data-entry="22"]'), /^Test:/)).toBeVisible()
    await page.goto('routing/relayhosts')
    await expect(await rowAction(page, page.locator('[data-entry="3"]'), /^Test:/)).toBeVisible()
  })
})
import { clickRowAction, rowAction } from '../fixtures/row-actions'
