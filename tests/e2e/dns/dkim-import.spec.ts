// UI 010 US5, importing a private key (T076): a new key, an overwrite with its confirmation and
// version tag, refused keys with the input kept, the file chooser, the leave question, the inputs
// that never alter the key, and no access for domain administrators.
import { DNS_PEM_FIXTURES } from '../../mocks/scenarios/dns'
import { politeRegion } from '../fixtures/flows'
import { expect, test } from '../fixtures/test'
import { FIRST_LOAD } from './helpers'

test.describe('DKIM import', () => {
  test('US5-AS1 a pasted key for example.net shows the derived record, and the key is gone', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
  }) => {
    await mockApi.use('dns-admin-keys')
    await page.goto('dns/dkim-import')
    await expect(page.getByRole('heading', { level: 1, name: 'Import private key' })).toBeVisible({
      timeout: FIRST_LOAD,
    })
    await expectAccessible()
    await expectNoHorizontalScroll()
    await page.getByLabel('Domain').fill('example.net')
    await page.getByLabel('Selector').fill('mx2024')
    await page.locator('#dkim-import-key').fill(DNS_PEM_FIXTURES.pkcs8)
    await page.getByRole('button', { name: 'Import', exact: true }).click()
    await expect(page).toHaveURL(/\/dns\/dkim-keys\/example\.net$/)
    await expect(page.getByText('Key valid')).toBeVisible()
    await expect(page.locator('[data-dkim-record]')).toContainText('mx2024._domainkey.example.net')
    await expect(politeRegion(page)).toHaveText('DKIM key example.net has been saved')
    expect(page.url()).not.toContain('PRIVATE')
    await page.goto('dns/dkim-import')
    await expect(page.locator('#dkim-import-key')).toHaveValue('')
  })

  test('US5-AS2 FR-030 overwriting example.org asks first and sends the version tag', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('dns-admin-keys')
    await page.goto('dns/dkim-import?name=example.org')
    await expect(page.locator('[data-import-existing]')).toContainText(
      'selector dkim, 2,048 bits',
      {
        timeout: FIRST_LOAD,
      },
    )
    await page.locator('#dkim-import-key').fill(DNS_PEM_FIXTURES.pkcs8)
    await page.getByRole('button', { name: 'Import', exact: true }).click()
    await expect(page.locator('#dkim-import-name-error')).toContainText(
      'A DKIM key for "example.org" exists and will not be overwritten',
    )
    await page.getByRole('button', { name: 'Switch on overwrite' }).click()
    await expect(page.getByLabel('Overwrite existing DKIM key')).toBeChecked()
    await page.getByRole('button', { name: 'Import', exact: true }).click()
    const ask = page.getByRole('alertdialog')
    await expect(ask).toContainText(
      'The key dkim (2,048 bits) and its private key are removed completely',
    )
    await ask.getByRole('button', { name: 'Import' }).click()
    await expect(page).toHaveURL(/\/dns\/dkim-keys\/example\.org$/)
    const sent = (await mockApi.requests()).filter((r) => r.operationId === 'importDkimKey')
    expect(sent.at(-1)?.headers['if-match']).toMatch(/^".+"$/)
    expect(JSON.stringify(sent)).not.toContain('PRIVATE KEY')
  })

  test('US5-AS3 FR-032 refused keys show their rule and keep the input', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('dns-admin-keys')
    await page.goto('dns/dkim-import?name=example.net')
    const key = page.locator('#dkim-import-key')
    for (const [pem, message] of [
      [DNS_PEM_FIXTURES.encrypted, 'protected by a passphrase'],
      [DNS_PEM_FIXTURES.ec, 'Only these key types are supported'],
      [DNS_PEM_FIXTURES.rsa512, 'The key must have 1,024 to 8,192 bits.'],
      ['not a key', 'This is not a valid PEM private key.'],
    ] as const) {
      await key.fill(pem)
      await page.getByRole('button', { name: 'Import', exact: true }).click()
      await expect(page.locator('#dkim-import-key-error')).toContainText(message, {
        timeout: FIRST_LOAD,
      })
      await expect(page.locator('#dkim-import-key-error')).not.toContainText('PRIVATE KEY')
      await expect(key).toHaveValue(pem)
    }
  })

  test('FR-029 FR-033 FR-076 checks before sending, the file chooser and the leave question', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('dns-admin-keys')
    await page.goto('dns/dkim-keys')
    await page.getByRole('link', { name: 'Import private key' }).click({ timeout: FIRST_LOAD })
    await expect(page.getByText('RSA PKCS#8 or PKCS#1, 1,024 to 8,192 bits')).toBeVisible({
      timeout: FIRST_LOAD,
    })
    const key = page.locator('#dkim-import-key')
    for (const attribute of [
      ['spellcheck', 'false'],
      ['autocorrect', 'off'],
      ['autocomplete', 'off'],
      ['autocapitalize', 'none'],
    ]) {
      await expect(key).toHaveAttribute(attribute[0]!, attribute[1]!)
    }
    await page.getByLabel('Domain').fill('not a domain')
    await page.getByRole('button', { name: 'Import', exact: true }).click()
    await expect(page.locator('#dkim-import-name-error')).toContainText('valid domain name')
    await expect(page.locator('#dkim-import-key-error')).toContainText('This field is required.')
    expect((await mockApi.requests()).some((r) => r.operationId === 'importDkimKey')).toBe(false)
    await page.getByLabel('Domain').fill('Unused.Example')
    await expect(page.locator('[data-import-unused]')).toBeVisible()
    await page.locator('input[type="file"]').setInputFiles({
      name: 'key.pem',
      mimeType: 'text/plain',
      buffer: Buffer.from(DNS_PEM_FIXTURES.pkcs1Crlf),
    })
    // A text area holds line breaks as LF; the API accepts both.
    const asTyped = DNS_PEM_FIXTURES.pkcs1Crlf.replace(/\r\n/g, '\n')
    await expect(key).toHaveValue(asTyped)
    await page.evaluate(() => history.back())
    await expect(page.getByRole('alertdialog')).toContainText(
      'The private key you entered will be discarded.',
    )
    await page.getByRole('alertdialog').getByRole('button', { name: 'Stay' }).click()
    await expect(key).toHaveValue(asTyped)
  })

  test('Edge: CRLF and blank lines are accepted as pasted', async ({ page, mockApi }) => {
    await mockApi.use('dns-admin-keys')
    await page.goto('dns/dkim-import?name=example.net')
    await page.locator('#dkim-import-key').fill(DNS_PEM_FIXTURES.pkcs1Crlf, { timeout: FIRST_LOAD })
    await page.getByRole('button', { name: 'Import', exact: true }).click()
    await expect(page).toHaveURL(/\/dns\/dkim-keys\/example\.net$/)
  })

  test('a domain administrator has no access to the import', async ({ page, mockApi }) => {
    await mockApi.use('dns-domain-admin')
    await page.goto('dns/dkim-import')
    await expect(page.getByRole('heading', { level: 1, name: 'No access' })).toBeVisible({
      timeout: FIRST_LOAD,
    })
  })
})
