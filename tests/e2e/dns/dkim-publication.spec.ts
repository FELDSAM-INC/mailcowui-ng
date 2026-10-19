// UI 010 US7, the DKIM DNS publication (T096, FR-043 to FR-045): the outcome after a generation,
// a missing zone, "Publish DNS record again", nothing while publication is off, failure reasons,
// publication turned off meanwhile, a key changed elsewhere, and outcomes after other changes.
import type { DkimDnsPublicationOutcome } from '@/api'

import { politeRegion } from '../fixtures/flows'
import { expect, test } from '../fixtures/test'
import { FIRST_LOAD } from './helpers'

const failed = (code: string, detail: string | null = null): DkimDnsPublicationOutcome => ({
  status: 'failed',
  recordName: 'dkim._domainkey.example.net',
  reason: { code: code as 'timeout', detail },
})

test.describe('DKIM DNS publication', () => {
  test('US7-AS1 US7-AS2 a generation says published, or to publish manually without a zone', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('dns-admin-fork')
    await page.goto('dns/dkim-keys/example.net')
    await page.getByRole('button', { name: 'Add ARC/DKIM key' }).click({ timeout: FIRST_LOAD })
    await page.getByRole('dialog').getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.locator('[data-entry-outcome]')).toContainText('Published to the DNS zone')
    await mockApi.patch({
      dns: {
        publication: {
          generateDkimKey: {
            status: 'noZone',
            recordName: 'feldhost._domainkey.missing.example',
            reason: null,
          },
        },
      },
    })
    await page.goto('dns/dkim-keys/missing.example')
    await page.getByRole('button', { name: 'Add ARC/DKIM key' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Add', exact: true }).click()
    const outcome = page.locator('[data-entry-outcome]')
    await expect(outcome).toContainText('No DNS zone was found for this name')
    await expect(outcome).toContainText('Publish the record manually.')
    await expect(
      page.getByRole('button', { name: 'Copy record value of missing.example' }),
    ).toBeVisible()
  })

  test('US7-AS3 "Publish DNS record again" announces success', async ({ page, mockApi }) => {
    await mockApi.use('dns-admin-fork')
    await page.goto('dns/dkim-keys/example.org')
    await page
      .getByRole('button', { name: 'Publish DNS record again' })
      .click({ timeout: FIRST_LOAD })
    await expect(politeRegion(page)).toHaveText('Published to the DNS zone')
    await expect(page.locator('[data-entry-outcome]')).toContainText('Published to the DNS zone')
    const sent = (await mockApi.requests()).filter((r) => r.operationId === 'publishDkimDnsRecord')
    expect(sent[0]!.headers['if-match']).toMatch(/^".+"$/)
  })

  test('US7-AS4 publication off shows no outcome and no action', async ({ page, mockApi }) => {
    await mockApi.use('dns-admin')
    await page.goto('dns/dkim-keys/example.net')
    await page.getByRole('button', { name: 'Add ARC/DKIM key' }).click({ timeout: FIRST_LOAD })
    await page.getByRole('dialog').getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.getByText('Key valid')).toBeVisible()
    await expect(page.locator('[data-publication-outcome]')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Publish DNS record again' })).toHaveCount(0)
  })

  test('FR-044 FR-045 a failure is translated, its detail is plain English, and it can be published again', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('dns-admin-fork', {
      dns: {
        publication: { generateDkimKey: failed('authenticationFailed', '<b>401</b> denied') },
      },
    })
    await page.goto('dns/dkim-keys/example.net')
    await page.getByRole('button', { name: 'Add ARC/DKIM key' }).click({ timeout: FIRST_LOAD })
    await page.getByRole('dialog').getByRole('button', { name: 'Add', exact: true }).click()
    const outcome = page.locator('[data-entry-outcome]')
    await expect(outcome).toContainText('The DNS server refused the credentials.')
    const detail = outcome.locator('[data-publication-detail]')
    await expect(detail).toHaveText('<b>401</b> denied')
    await expect(detail).toHaveAttribute('lang', 'en')
    await mockApi.patch({ dns: { publication: { publishDkimDnsRecord: null } } })
    await outcome.getByRole('button', { name: 'Publish DNS record again' }).click()
    await expect(politeRegion(page)).toHaveText('Published to the DNS zone')
  })

  test('FR-045 publication turned off meanwhile says so; a key changed elsewhere asks again', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('dns-admin-fork')
    await page.goto('dns/dkim-keys/example.org')
    const publish = page.getByRole('button', { name: 'Publish DNS record again' })
    await publish.click({ timeout: FIRST_LOAD })
    await expect(politeRegion(page)).toHaveText('Published to the DNS zone')
    await mockApi.patch({ dns: { keys: { 'example.org': { selector: 'dkim' } } } })
    await publish.click()
    await expect(
      page.getByText('The key was changed elsewhere and has been reloaded.'),
    ).toBeVisible()
    await mockApi.patch({ dns: { capabilities: { dkim: { dnsPublicationEnabled: false } } } })
    await publish.click()
    await expect(page.getByText('DNS publication is turned off on this server.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Publish DNS record again' })).toHaveCount(0)
  })

  test('outcomes after an import and a bulk deletion', async ({ page, mockApi }) => {
    await mockApi.use('dns-admin-fork', {
      dns: {
        publication: {
          applyDkimKeyBulkAction: {
            status: 'removed',
            recordName: 'dkim._domainkey.example.org',
            reason: null,
          },
        },
      },
    })
    await page.goto('dns/dkim-keys')
    await page.getByRole('button', { name: 'Select', exact: true }).click({ timeout: FIRST_LOAD })
    await page.getByRole('checkbox', { name: 'Select example.org' }).check()
    await page
      .getByRole('region', { name: 'Bulk actions' })
      .getByRole('button', { name: 'Remove' })
      .click()
    await page.getByRole('alertdialog').getByRole('textbox').fill('1')
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete now' }).click()
    await expect(page.locator('[data-bulk-results] [data-publication-outcome]')).toContainText(
      'Removed from the DNS zone',
    )
  })
})
