// UI 010 US1, a DKIM entry (T032): the record with its name, host label and value copied character
// for character, the split form, names without or with an incomplete key, long values, loading and
// errors, not found, a key removed while open, a refused clipboard and an unused legacy spelling.
import { politeRegion } from '../fixtures/flows'
import { expect, test } from '../fixtures/test'
import { FIRST_LOAD, allowClipboard, clipboardText } from './helpers'

test.describe('DKIM entry', () => {
  test('US1-AS3 FR-017 SC-003 the record name, host label and value are copied exactly', async ({
    page,
    mockApi,
    browserName,
    expectAccessible,
    expectNoHorizontalScroll,
  }) => {
    const readable = await allowClipboard(page, browserName)
    await mockApi.use('dns-admin')
    await page.goto('dns/dkim-keys/example.org')
    await expect(page.getByRole('heading', { level: 1, name: 'example.org' })).toBeVisible({
      timeout: FIRST_LOAD,
    })
    const record = page.locator('[data-dkim-record]')
    await expect(record).toContainText('dkim._domainkey.example.org')
    await expect(record.locator('[data-record-value]').nth(1)).toHaveText('dkim._domainkey')
    const value = (await record.locator('[data-record-value]').nth(2).textContent()) ?? ''
    expect(value).toMatch(/^v=DKIM1;k=rsa;t=s;s=email;p=/)
    for (const [label, expected] of [
      ['Copy record name of example.org', 'dkim._domainkey.example.org'],
      ['Copy host label of example.org', 'dkim._domainkey'],
      ['Copy record value of example.org', value],
    ]) {
      await page.getByRole('button', { name: label }).click()
      await expect(politeRegion(page)).toHaveText('Text copied to clipboard!')
      if (readable) expect(await clipboardText(page)).toBe(expected)
    }
    await expectAccessible()
    await expectNoHorizontalScroll()
  })

  test('US1-AS4 the split form shows quoted pieces, and copying copies that form', async ({
    page,
    mockApi,
    browserName,
  }) => {
    const readable = await allowClipboard(page, browserName)
    await mockApi.use('dns-admin')
    await page.goto(`dns/dkim-keys/${encodeURIComponent('aaa')}`.replace('aaa', 'shop.example'))
    await page.getByRole('radio', { name: 'Split into 255-character pieces' }).click()
    const shown =
      (await page.locator('[data-record-form="split"] [data-record-value]').textContent()) ?? ''
    expect(shown).toMatch(/^"v=DKIM1;k=rsa;t=s;s=email;p=[^"]+" "[^"]+"/)
    for (const piece of shown.match(/"([^"]*)"/g) ?? [])
      expect(piece.length - 2).toBeLessThanOrEqual(255)
    await page.getByRole('button', { name: 'Copy record value of shop.example' }).click()
    if (readable) expect(await clipboardText(page)).toBe(shown)
  })

  test('FR-016 a name without a key is not signed; an incomplete key names its missing parts', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('dns-admin')
    await page.goto('dns/dkim-keys/example.net')
    await expect(page.locator('[data-not-signed]')).toContainText('Its mail is not signed')
    await expect(page.getByText('Key missing')).toBeVisible()
    await page.goto('dns/dkim-keys/incomplete.example')
    const notice = page.locator('[data-incomplete-notice]')
    await expect(notice).toContainText('This key is incomplete')
    await expect(notice).toContainText('public key and private key')
    await expect(
      page.getByText('No record can be published until the key is complete.'),
    ).toBeVisible()
    await expectAccessible()
  })

  test('FR-018 a 4,096-bit value wraps at 360 px', async ({
    page,
    mockApi,
    expectNoHorizontalScroll,
  }) => {
    await mockApi.use('dns-admin')
    await page.goto('dns/dkim-keys')
    await page.goto(
      `dns/dkim-keys/${'a'.repeat(63)}.${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(53)}.example`,
    )
    await expect(page.locator('[data-dkim-record]')).toBeVisible()
    await expectNoHorizontalScroll()
  })

  test('FR-020 FR-004 loading failure with retry, and the not-found page for an unknown name', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('dns-domain-admin')
    await page.goto('dns/dkim-keys/old.example')
    await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
    await page.getByRole('link', { name: 'Back' }).click()
    await expect(page).toHaveURL(/\/dns\/dkim-keys$/)
    await mockApi.failNext('getDkimKey', { status: 500 })
    await page.goto('dns/dkim-keys/example.org')
    await expect(page.getByText('The DKIM key could not be loaded.')).toBeVisible()
    await page.getByRole('button', { name: 'Try again' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'example.org' })).toBeVisible()
  })

  test('Edge: a key removed while open says it no longer exists on refresh', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('dns-admin')
    await page.goto('dns/dkim-keys/old.example')
    await expect(page.getByRole('heading', { level: 1, name: 'old.example' })).toBeVisible()
    await mockApi.patch({ dns: { keys: { 'old.example': null } } })
    await page.goto('dns/dkim-keys')
    await page.goto('dns/dkim-keys/old.example')
    await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
  })

  test('Edge: a refused clipboard selects the value with a message', async ({ page, mockApi }) => {
    await mockApi.use('dns-admin')
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: () => Promise.reject(new DOMException('denied', 'NotAllowedError')) },
      })
    })
    await page.goto('dns/dkim-keys/example.org')
    await page.getByRole('button', { name: 'Copy record value of example.org' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'did not allow copying' })).toBeVisible()
    const selected = await page.evaluate(() => window.getSelection()?.toString() ?? '')
    expect(selected).toMatch(/^v=DKIM1;/)
  })

  test('Edge: the unused Legacy.Example entry opens by its stored name', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('dns-admin')
    await page.goto('dns/dkim-keys/Legacy.Example')
    await expect(page.getByRole('heading', { level: 1, name: 'Legacy.Example' })).toBeVisible()
    await expect(page.getByText('Key unused')).toBeVisible()
    await expect(page.locator('[data-dkim-record]')).toContainText(
      'legacy._domainkey.Legacy.Example',
    )
  })
})
