// UI 010 T108 (SC-006, FR-002 to FR-004): the actions of an administrator and of a domain
// administrator, with export and publication on and off, equal the matrix; a role changed mid-
// session refreshes the actions; a mailbox user gets "no access" on every DNS address.
import { expect, test } from '../fixtures/test'
import { FIRST_LOAD } from './helpers'

const ADMIN_ACTIONS = ['Replace with a new key', 'Remove']

test.describe('DNS permissions', () => {
  for (const [label, overrides, exportOn, publication] of [
    [
      'export and publication on',
      {
        dns: {
          capabilities: { dkim: { privateKeyExportEnabled: true, dnsPublicationEnabled: true } },
        },
      },
      true,
      true,
    ],
    ['export and publication off', {}, false, false],
  ] as const) {
    test(`SC-006 the administrator's actions with ${label}`, async ({ page, mockApi }) => {
      await mockApi.use('dns-admin', overrides)
      await page.goto('dns/dkim-keys/example.org')
      await expect(page.getByRole('heading', { level: 1, name: 'example.org' })).toBeVisible({
        timeout: FIRST_LOAD,
      })
      for (const name of ADMIN_ACTIONS)
        await expect(page.getByRole('button', { name })).toBeVisible()
      await expect(page.getByRole('link', { name: 'Import private key' })).toBeVisible()
      await expect(page.getByRole('link', { name: 'Duplicate' })).toBeVisible()
      await expect(page.getByRole('link', { name: 'History' })).toBeVisible()
      await expect(page.getByRole('link', { name: 'DNS diagnostics' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Private key' })).toHaveCount(exportOn ? 1 : 0)
      await expect(page.locator('[data-export-off]')).toHaveCount(exportOn ? 0 : 1)
      await expect(page.getByRole('button', { name: 'Publish DNS record again' })).toHaveCount(
        publication ? 1 : 0,
      )
      await page.goto('dns/dkim-keys')
      await expect(page.getByRole('link', { name: 'Import private key' })).toBeVisible()
      await expect(
        page.getByRole('button', { name: 'Select domains with missing keys' }),
      ).toBeVisible()
    })
  }

  test('SC-006 a domain administrator only reads, generates and checks DNS', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('dns-domain-admin', {
      dns: {
        capabilities: { dkim: { privateKeyExportEnabled: true, dnsPublicationEnabled: true } },
      },
    })
    await page.goto('dns/dkim-keys/example.org')
    await expect(page.getByRole('heading', { level: 1, name: 'example.org' })).toBeVisible({
      timeout: FIRST_LOAD,
    })
    for (const name of [...ADMIN_ACTIONS, 'Private key', 'Publish DNS record again']) {
      await expect(page.getByRole('button', { name })).toHaveCount(0)
    }
    await expect(page.getByRole('link', { name: 'History' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'DNS diagnostics' })).toBeVisible()
    await page.goto('dns/dkim-keys/example.net')
    await expect(page.getByRole('button', { name: 'Add ARC/DKIM key' })).toBeVisible({
      timeout: FIRST_LOAD,
    })
    await page.goto('dns/dkim-keys')
    await expect(page.getByRole('link', { name: 'Import private key' })).toHaveCount(0)
  })

  test('FR-003 a role changed mid-session refreshes the actions', async ({ page, mockApi }) => {
    await mockApi.use('dns-admin')
    await page.goto('dns/dkim-keys/example.org')
    const record = page.locator('[data-record-form="single"] code')
    await expect(record).toBeVisible({ timeout: FIRST_LOAD })
    const originalRecord = await record.innerText()
    await page.getByRole('button', { name: 'Remove' }).click({ timeout: FIRST_LOAD })
    await mockApi.patch({
      accounts: {
        admin: { role: 'domainAdmin', scope: { type: 'domains', domains: ['example.org'] } },
      },
    })
    const refused = page.waitForResponse(
      (response) =>
        response.request().method() === 'DELETE' &&
        new URL(response.url()).pathname === '/api/v2/dkim-keys/example.org',
    )
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete now' }).click()
    expect((await refused).status()).toBe(403)
    // The refreshed role starts a full identity transition: its old page/error is discarded,
    // then this still-allowed DNS entry is read again with domain-administrator permissions.
    await expect(page.getByRole('alert')).toContainText('The account changed in another tab.')
    await expect(page).toHaveURL(/\/dns\/dkim-keys\/example\.org$/)
    await expect(page.getByRole('heading', { level: 1, name: 'example.org' })).toBeVisible()
    await expect(page.getByText('Key valid', { exact: true })).toBeVisible()
    await expect(record).toHaveText(originalRecord)
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    for (const name of [...ADMIN_ACTIONS, 'Private key', 'Publish DNS record again']) {
      await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0)
    }
    for (const name of ['Import private key', 'Duplicate', 'History']) {
      await expect(page.getByRole('link', { name, exact: true })).toHaveCount(0)
    }
    await expect(page.getByRole('link', { name: 'DNS diagnostics', exact: true })).toBeVisible()
    expect(await mockApi.countRequests('deleteDkimKey')).toBe(1)
  })

  test('FR-004 a mailbox user gets "no access" on every DNS address', async ({ page, mockApi }) => {
    await mockApi.use('mailbox-no-spam-flags')
    for (const path of [
      'dns/dkim-keys',
      'dns/dkim-keys/example.org',
      'dns/dkim-import',
      'dns/dkim-keys/example.org/copy',
      'dns/mta-sts-policies',
      'dns/diagnostics/example.org',
    ]) {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1, name: 'No access' })).toBeVisible({
        timeout: FIRST_LOAD,
      })
    }
  })
})
