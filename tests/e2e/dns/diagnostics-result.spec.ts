// UI 010 US3, the result of the DNS diagnostics (T053): statuses as icon and text in the classic
// columns, optional checks, guidance and reasons, copy buttons, the summary and its filter, the
// server facts, the zone file, the layouts, and the edge cases.
import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { FIRST_LOAD, allowClipboard, clipboardText, isNarrow } from './helpers'

/** Opens the diagnostics of a name and waits for the result. */
async function openResult(page: Page, name = 'example.org') {
  await page.goto(`dns/diagnostics/${name}`)
  await expect(page.getByRole('heading', { level: 1, name: 'DNS Records' })).toBeVisible({
    timeout: FIRST_LOAD,
  })
  await expect(page.locator('[data-diagnostics-summary]')).toBeVisible({ timeout: FIRST_LOAD })
}

const checkRow = (page: Page, id: string) => page.locator(`[data-check-id="${id}"]`)

test.describe('DNS diagnostics result', () => {
  test('US3-AS1 US3-AS2 FR-059 FR-060 FR-068 statuses, the classic columns and the groups', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
    expectTouchTargets,
  }) => {
    await mockApi.use('dns-diagnostics-all-statuses')
    await openResult(page)
    await expect(
      page.getByText('Please note that changes made to DNS may take up to 24 hours'),
    ).toBeVisible()
    const mx = checkRow(page, 'mx')
    await expect(mx).toContainText('Mail exchanger')
    await expect(mx.locator('[data-check-status]')).toHaveText('Correct')
    await expect(mx.locator('[data-check-found]')).toContainText('mail.example.org')
    const service = checkRow(page, 'srv:autodiscover')
    await expect(service.locator('[data-check-status]')).toHaveText('Missing')
    await expect(service.locator('[data-check-status]')).toHaveAttribute(
      'data-group',
      'needsAttention',
    )
    await expect(page.getByRole('heading', { level: 2, name: 'Server-wide records' })).toBeVisible()
    await expect(
      page.getByRole('heading', { level: 2, name: 'Records of this name' }),
    ).toBeVisible()
    if (isNarrow(page)) {
      await expect(page.getByRole('list', { name: 'Records of this name' })).toBeVisible()
      await expect(mx.getByRole('heading', { level: 3, name: 'Mail exchanger' })).toBeVisible()
      await expectTouchTargets()
    } else {
      const table = page.getByRole('table', { name: 'Records of this name' })
      await expect(table.getByRole('columnheader')).toHaveText([
        'Name',
        'Type',
        'Correct Data',
        'Current State',
      ])
    }
    const ids = await page
      .locator('[data-check-id]')
      .evaluateAll((items) => items.map((item) => item.getAttribute('data-check-id')))
    expect(ids.slice(0, 5)).toEqual(['a', 'ptr:ipv4', 'aaaa', 'ptr:ipv6', 'tlsa:25'])
    await expectAccessible()
    await expectNoHorizontalScroll()
  })

  test('US3-AS3 US3-AS4 US3-AS5 optional records, guidance, reasons and the DKIM value', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('dns-diagnostics-all-statuses')
    await openResult(page)
    const dmarc = checkRow(page, 'dmarc')
    await expect(dmarc.locator('[data-check-status]')).toHaveText('Not set (optional)')
    await expect(dmarc).toContainText('This record is optional.')
    await expect(dmarc).toContainText('Publish a DMARC policy for this name.')
    const learnMore = dmarc.getByRole('link', { name: /Learn more/ })
    await expect(learnMore).toHaveAttribute('target', '_blank')
    await expect(learnMore).toHaveAttribute('rel', 'noopener noreferrer')
    const spf = checkRow(page, 'spf')
    await expect(spf.locator('[data-check-status]')).toHaveText('Different value')
    await expect(spf).toContainText('This record is optional.')
    await expect(spf.locator('[data-check-status]')).toHaveAttribute('data-group', 'needsAttention')
    await expect(spf).toContainText(
      'does not authorise the server address 192.0.2.25 (result: fail)',
    )
    const dkim = checkRow(page, 'dkim:dkim')
    await expect(dkim).toContainText('DKIM (selector dkim)')
    await expect(dkim.locator('[data-check-status]')).toHaveText('Different value')
    await expect(dkim).toContainText('different public key')
    await expect(
      dkim.getByRole('button', { name: 'Copy expected value of DKIM (selector dkim)' }),
    ).toBeVisible()
    await expect(dkim.locator('[data-check-found]')).toContainText('v=DKIM1;k=rsa;p=MIIB')
    await expect(page.locator('[data-summary-group="needsAttention"]')).toHaveText(
      '4 need attention',
    )
    await expect(page.locator('[data-summary-group="optionalNotSet"]')).toHaveText(
      '1 optional, not set',
    )
    await expect(page.locator('[data-summary-group="notVerified"]')).toHaveText('2 not verified')
    await expect(page.locator('[data-summary-group="ok"]')).toHaveText('10 correct')
  })

  test('US3-AS6 checks that ran out of time say so, with the notice and "Run again"', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('dns-diagnostics-partial')
    await openResult(page)
    await expect(
      page.locator('[data-check-status]', { hasText: 'Could not be checked' }),
    ).toHaveCount(3)
    await expect(checkRow(page, 'srv:imaps')).toContainText('time limit of 30 seconds')
    await expect(page.locator('[data-diagnostics-partial]')).toContainText(
      'Some records could not be checked',
    )
    await expect(page.getByRole('button', { name: 'Run again' }).first()).toBeEnabled()
  })

  test('US3-AS8 a domain administrator sees no server-wide group', async ({ page, mockApi }) => {
    await mockApi.use('dns-domain-admin')
    await openResult(page)
    await expect(page.getByRole('heading', { name: 'Server-wide records' })).toHaveCount(0)
    await expect(page.locator('[data-result-notes]')).toContainText('administrators only')
  })

  test('US3-AS9 SC-009 FR-067 the zone file downloads and copies exactly, collapsed by default', async ({
    page,
    mockApi,
    browserName,
  }) => {
    const readable = await allowClipboard(page, browserName)
    await mockApi.use('dns-admin')
    await openResult(page)
    const panel = page.locator('[data-zone-panel]')
    await expect(panel.locator('[data-zone-toggle]')).toHaveAttribute('aria-expanded', 'false')
    await expect(panel.locator('[data-zone-file]')).toHaveCount(0)
    const response = await page.request.get('/api/v2/dns-diagnostics/example.org')
    const zoneFile = ((await response.json()) as { data: { zoneFile: string } }).data.zoneFile
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      panel.getByRole('button', { name: 'Download' }).click(),
    ])
    expect(download.suggestedFilename()).toBe('example.org.txt')
    const path = await download.path()
    const { readFileSync } = await import('node:fs')
    expect(readFileSync(path, 'utf8')).toBe(zoneFile)
    await panel.getByRole('button', { name: 'Copy zone file' }).click()
    if (readable) expect(await clipboardText(page)).toBe(zoneFile)
    await panel.locator('[data-zone-toggle]').click()
    await expect(panel.locator('[data-zone-file]')).toHaveText(zoneFile.trimEnd())
  })

  test('FR-061 copy buttons named after the check copy the record name and the expected value', async ({
    page,
    mockApi,
    browserName,
  }) => {
    const readable = await allowClipboard(page, browserName)
    await mockApi.use('dns-admin')
    await openResult(page)
    const mx = checkRow(page, 'mx')
    await mx.getByRole('button', { name: 'Copy record name of Mail exchanger' }).click()
    if (readable) expect(await clipboardText(page)).toBe('example.org')
    await mx.getByRole('button', { name: 'Copy expected value of Mail exchanger' }).click()
    if (readable) expect(await clipboardText(page)).toBe('mail.example.org')
    await expect(mx.locator('[data-check-found] button')).toHaveCount(0)
  })

  test('FR-062 FR-063 FR-064 the filter, the SPF guidance and the server facts', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('dns-diagnostics-all-statuses')
    await openResult(page)
    const facts = page.locator('[data-server-facts]')
    await expect(facts).toContainText('mail.example.org')
    await expect(facts).toContainText('192.0.2.25')
    await expect(facts).toContainText('2001:db8::25')
    const spf = checkRow(page, 'spf')
    await expect(spf.getByRole('button', { name: 'Copy ip4:192.0.2.25' })).toBeVisible()
    await expect(spf.getByRole('button', { name: 'Copy v=spf1 mx a ~all' })).toBeVisible()
    await expect(spf).toContainText('Allow')
    await page.getByRole('checkbox', { name: /Only checks that need attention/ }).check()
    await expect(checkRow(page, 'mx')).toHaveCount(0)
    await expect(checkRow(page, 'autoconfig')).toBeVisible()
    await expect(checkRow(page, 'tlsa:25')).toBeVisible()
    await expect(checkRow(page, 'dmarc')).toHaveCount(0)
  })

  test('FR-062 all required records are correct on a healthy name', async ({ page, mockApi }) => {
    await mockApi.use('dns-admin')
    await openResult(page)
    await expect(page.locator('[data-required-correct]')).toHaveText(
      'All required records are correct.',
    )
  })

  test('Edge: an alias domain names its target and explains the MTA-STS checks', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('dns-diagnostics-alias')
    await openResult(page, 'example.com')
    const alias = page.locator('[data-alias-target]')
    await expect(alias).toContainText('Alias domain of example.org')
    await expect(alias).toContainText('policy of example.org')
    await expect(checkRow(page, 'mta-sts-record')).toBeVisible()
  })

  test('Edge: no IPv6, a certificate that cannot be read and a host that is an alias', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('dns-diagnostics-no-ipv6')
    await openResult(page)
    await expect(page.locator('[data-no-ipv6]')).toHaveText('No public IPv6 address')
    await expect(page.locator('[data-result-notes]')).toContainText('no public IPv6 address')
    await expect(checkRow(page, 'aaaa')).toHaveCount(0)
    await mockApi.use('dns-diagnostics-all-statuses')
    await openResult(page)
    const tlsa = checkRow(page, 'tlsa:25')
    await expect(tlsa.locator('[data-check-status]')).toHaveText('Cannot be verified')
    await expect(tlsa).toContainText('the server refused STARTTLS')
    const autoconfig = checkRow(page, 'autoconfig')
    await expect(autoconfig.locator('[data-check-status]')).toHaveText('Different value')
    await expect(autoconfig).toContainText('alias (CNAME) of mx.provider.example')
    await expect(checkRow(page, 'autodiscover')).toContainText('Value derived from A/AAAA record')
  })

  test('Edge: markup and bidi controls stay literal, every value is listed, an unknown check by its type', async ({
    page,
    mockApi,
    expectNoHorizontalScroll,
  }) => {
    await mockApi.use('dns-diagnostics-markup')
    await openResult(page)
    const found = checkRow(page, 'mx').locator('[data-check-found] code')
    await expect(found).toHaveCount(3)
    await expect(found.nth(0)).toHaveText('<script>alert(1)</script>')
    await expect(found.nth(1)).toHaveText('mail.example.org\\u{202E}evil.example')
    await expect(page.locator('script', { hasText: 'alert(1)' })).toHaveCount(0)
    await expect(checkRow(page, 'srv:autodiscover').locator('[data-check-found]')).toHaveText(
      'No record found',
    )
    await expect(checkRow(page, 'caa')).toContainText('TXT record')
    await expectNoHorizontalScroll()
  })
})
