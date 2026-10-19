// UI 010 T107 (SC-007, FR-076): after an import, an export and a copy, storage holds only UI 001's
// allowed keys, and no stored value, address, history state or live region carries a private key;
// with storage throwing, every DNS screen still works.
import type { Page } from '@playwright/test'

import { DNS_PEM_FIXTURES } from '../../mocks/scenarios/dns'
import { expect, test } from '../fixtures/test'
import { FIRST_LOAD } from './helpers'

async function leftovers(page: Page): Promise<string> {
  return page.evaluate(() =>
    JSON.stringify({
      local: { ...localStorage },
      session: { ...sessionStorage },
      history: history.state as unknown,
      address: location.href,
      live: [...document.querySelectorAll('[data-live]')].map((node) => node.textContent),
    }),
  )
}

test.describe('DNS storage and secrets', () => {
  test('SC-007 no private key is left anywhere after an import, an export and a copy', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('dns-admin-fork')
    await page.goto('dns/dkim-import?name=example.net')
    await page.locator('#dkim-import-key').fill(DNS_PEM_FIXTURES.pkcs8, { timeout: FIRST_LOAD })
    await page.getByRole('button', { name: 'Import', exact: true }).click()
    await expect(page).toHaveURL(/\/dns\/dkim-keys\/example\.net$/)

    await page.getByRole('button', { name: 'Private key' }).click()
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Show the private key' })
      .click()
    await expect(page.getByRole('dialog').locator('textarea')).toHaveValue(/PRIVATE KEY/)
    await page.getByRole('dialog').getByRole('button', { name: 'Copy' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)

    const keyLines = DNS_PEM_FIXTURES.pkcs8.split('\n').filter((line) => line.length > 40)
    const text = await leftovers(page)
    expect(text).not.toContain('PRIVATE KEY')
    for (const line of keyLines) expect(text).not.toContain(line)
    const storageKeys = await page.evaluate(() => [
      ...Object.keys(localStorage),
      ...Object.keys(sessionStorage),
    ])
    expect(storageKeys.every((key) => key.startsWith('mailcowui-ng.'))).toBe(true)
  })

  test('every DNS screen works with storage throwing', async ({ page, mockApi }) => {
    await page.addInitScript(() => {
      const fail = () => {
        throw new DOMException('denied', 'SecurityError')
      }
      for (const name of ['localStorage', 'sessionStorage'] as const) {
        Object.defineProperty(window, name, { configurable: true, get: fail })
      }
    })
    await mockApi.use('dns-mta-sts')
    for (const [path, heading] of [
      ['dns/dkim-keys', 'ARC/DKIM keys'],
      ['dns/dkim-keys/example.org', 'example.org'],
      ['dns/mta-sts-policies', 'MTA-STS'],
      ['dns/diagnostics/example.org', 'DNS Records'],
      ['dns/dkim-import', 'Import private key'],
    ] as const) {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible({
        timeout: FIRST_LOAD,
      })
    }
  })
})
