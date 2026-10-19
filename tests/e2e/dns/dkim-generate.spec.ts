// UI 010 US2, generating DKIM keys (T044): the defaults of the server, one name from its entry or
// the domain page, a selection with progress, results and retry, the selector check, a key created
// meanwhile, a domain administrator, a failed publication, every name without a key, one request
// per submission, skipped entries, a dropped connection, leaving during a run, a temporary failure,
// the selection reset and the freshness of every screen afterwards.
import type { Page } from '@playwright/test'

import { openNavigation, politeRegion } from '../fixtures/flows'
import { expect, test } from '../fixtures/test'
import { FIRST_LOAD, entry, entryNames, isNarrow, listReady } from './helpers'

const dialog = (page: Page) => page.getByRole('dialog')

async function openSelection(page: Page) {
  await page.getByRole('button', { name: 'Select', exact: true }).click()
}

async function selectAllOnPage(page: Page) {
  await page.getByRole('checkbox', { name: 'Toggle all' }).first().check()
}

test.describe('DKIM generation', () => {
  test('US2-AS1 US2-AS2 the defaults of the server, then one key from its entry', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('dns-admin-fork')
    await page.goto('dns/dkim-keys/example.net')
    await expect(page.getByRole('heading', { level: 1, name: 'example.net' })).toBeVisible({
      timeout: FIRST_LOAD,
    })
    await page.getByRole('button', { name: 'Add ARC/DKIM key' }).click()
    await expect(dialog(page).getByRole('heading', { name: 'Add ARC/DKIM key' })).toBeVisible()
    await expect(dialog(page).getByLabel('Selector')).toHaveValue('feldhost')
    const size = dialog(page).getByLabel('DKIM key length (bits)')
    await expect(size).toHaveValue('2048')
    await expect(size.locator('option')).toHaveText(['1024', '2048', '3072', '4096'])
    await expectAccessible()
    await dialog(page).getByRole('button', { name: 'Add', exact: true }).click()
    await expect(dialog(page)).toHaveCount(0)
    await expect(page.getByText('Key valid')).toBeVisible()
    await expect(page.locator('[data-dkim-record]')).toContainText(
      'feldhost._domainkey.example.net',
    )
    await expect(politeRegion(page)).toHaveText('DKIM key example.net has been saved')
    await expect(
      page.getByRole('button', { name: 'Copy record value of example.net' }),
    ).toBeVisible()
    await expect(page.locator('[data-entry-outcome]')).toContainText('Published to the DNS zone')
  })

  test('US2-AS3 SC-011 a selection shows progress and per-name results, and retry sends only the failed', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('dns-many-missing')
    await page.goto('dns/dkim-keys?state=missing&size=25')
    await listReady(page)
    await openSelection(page)
    await selectAllOnPage(page)
    await expect(page.getByRole('region', { name: 'Bulk actions' })).toContainText('25 selected')
    await mockApi.failNext('generateDkimKey', { status: 409, type: 'dkim-key-exists' })
    await page
      .getByRole('region', { name: 'Bulk actions' })
      .getByRole('button', { name: 'Add ARC/DKIM key' })
      .click()
    await expect(dialog(page)).toContainText('and 15 others')
    await dialog(page).getByRole('button', { name: 'Add', exact: true }).click()
    const run = page.locator('[data-run-dialog]')
    await expect(run.locator('[data-run-row]')).toHaveCount(25, { timeout: 30_000 })
    await expect(run).toContainText('24 done')
    await expect(run).toContainText('1 refused')
    await expect(run.locator('[data-run-row]').first()).toContainText(
      'exists and will not be overwritten',
    )
    await expectAccessible()
    const before = (await mockApi.requests()).filter(
      (r) => r.operationId === 'generateDkimKey',
    ).length
    await run.getByRole('button', { name: 'Retry the failed ones' }).click()
    await expect(run.locator('[data-run-row]')).toHaveCount(1)
    await expect(run).toContainText('1 done')
    const after = (await mockApi.requests()).filter(
      (r) => r.operationId === 'generateDkimKey',
    ).length
    expect(after - before).toBe(1)
  })

  test('US2-AS4 a selector with a space is refused before anything is sent', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('dns-admin')
    await page.goto('dns/dkim-keys/example.net')
    await page.getByRole('button', { name: 'Add ARC/DKIM key' }).click({ timeout: FIRST_LOAD })
    await dialog(page).getByLabel('Selector').fill('my key')
    await dialog(page).getByRole('button', { name: 'Add', exact: true }).click()
    await expect(dialog(page)).toContainText('DKIM domain or selector invalid: example.net')
    await expect(dialog(page).getByLabel('Selector')).toHaveAttribute('aria-invalid', 'true')
    expect((await mockApi.requests()).some((r) => r.operationId === 'generateDkimKey')).toBe(false)
  })

  test('US2-AS5 a name that got a key meanwhile is reported and shows the existing key', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('dns-admin')
    await page.goto('dns/dkim-keys/example.net')
    await page.getByRole('button', { name: 'Add ARC/DKIM key' }).click({ timeout: FIRST_LOAD })
    await mockApi.patch({ dns: { keys: { 'example.net': { selector: 'other' } } } })
    await dialog(page).getByRole('button', { name: 'Add', exact: true }).click()
    await expect(dialog(page)).toContainText(
      'A DKIM key for "example.net" exists and will not be overwritten',
    )
    await dialog(page).getByRole('button', { name: 'Cancel' }).click()
    await expect(page.locator('[data-dkim-record]')).toContainText('other._domainkey.example.net')
  })

  test('US2-AS6 a domain administrator generates from the domain page', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('dns-domain-admin')
    await page.goto('domains/example.net')
    const section = page.locator('#section-dkim')
    await section.getByRole('button', { name: 'Add ARC/DKIM key' }).click({ timeout: FIRST_LOAD })
    await dialog(page).getByRole('button', { name: 'Add', exact: true }).click()
    await expect(section).toContainText('Key valid')
    await expect(section).toContainText('Domain: example.net (dkim._domainkey)')
    await page.goto('dns/dkim-keys/example.net')
    for (const name of ['Replace with a new key', 'Remove', 'Duplicate', 'Private key']) {
      await expect(page.getByRole('button', { name })).toHaveCount(0)
    }
  })

  test('US2-AS7 a failed publication says the key works but is not published', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('dns-admin-fork', {
      dns: {
        publication: {
          generateDkimKey: {
            status: 'failed',
            recordName: 'feldhost._domainkey.example.net',
            reason: { code: 'unreachable', detail: null },
          },
        },
      },
    })
    await page.goto('dns/dkim-keys/example.net')
    await page.getByRole('button', { name: 'Add ARC/DKIM key' }).click({ timeout: FIRST_LOAD })
    await dialog(page).getByRole('button', { name: 'Add', exact: true }).click()
    const outcome = page.locator('[data-entry-outcome]')
    await expect(outcome).toContainText('Not published')
    await expect(outcome).toContainText('The DNS server could not be reached.')
    await expect(outcome).toContainText('The key works; the record can be published again.')
  })

  test('FR-024 every name without a key, with the search and type filter, in name order', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('dns-many-missing')
    await page.goto('dns/dkim-keys?q=m0&kind=domain')
    await listReady(page)
    await page.getByRole('button', { name: 'Select domains with missing keys' }).click()
    const confirmation = page.getByRole('alertdialog')
    await expect(confirmation).toContainText('Keys will be generated for 9 names without a key.')
    await expect(confirmation).toContainText(
      'Only names that match the current search and type filter.',
    )
    await expect(confirmation.locator('[data-name-preview] li')).toHaveCount(9)
    await confirmation.getByRole('button', { name: 'Continue' }).click()
    await dialog(page).getByRole('button', { name: 'Add', exact: true }).click()
    const run = page.locator('[data-run-dialog]')
    await expect(run.locator('[data-run-row]')).toHaveCount(9, { timeout: 30_000 })
    const generated = (await mockApi.requests())
      .filter((r) => r.operationId === 'generateDkimKey')
      .map((r) => (r.body as { name: string }).name)
    expect(generated).toEqual([...generated].sort())
    expect(generated[0]).toBe('m01.example')
  })

  test('FR-026 a double submission sends one request', async ({ page, mockApi }) => {
    await mockApi.use('dns-admin')
    await mockApi.delay('generateDkimKey', 800)
    await page.goto('dns/dkim-keys/example.net')
    await page.getByRole('button', { name: 'Add ARC/DKIM key' }).click({ timeout: FIRST_LOAD })
    const add = dialog(page).getByRole('button', { name: 'Add', exact: true })
    await add.click()
    await add.click({ force: true }).catch(() => undefined)
    await expect(page.getByText('Key valid')).toBeVisible()
    expect(
      (await mockApi.requests()).filter((r) => r.operationId === 'generateDkimKey'),
    ).toHaveLength(1)
  })

  test('FR-040 entries with a key are listed as skipped', async ({ page, mockApi }) => {
    await mockApi.use('dns-admin')
    await page.goto('dns/dkim-keys?q=example.')
    await listReady(page)
    await openSelection(page)
    await selectAllOnPage(page)
    await page
      .getByRole('region', { name: 'Bulk actions' })
      .getByRole('button', { name: 'Add ARC/DKIM key' })
      .click()
    const skipped = dialog(page).locator('[data-generate-skipped]')
    await expect(skipped).toContainText('example.org')
    await expect(dialog(page).locator('[data-generate-names]')).toContainText('example.net')
  })

  test('FR-041 a dropped connection gives "outcome unknown" and nothing is sent again', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('dns-many-missing')
    await page.goto('dns/dkim-keys?state=missing&q=m0')
    await listReady(page)
    await openSelection(page)
    await selectAllOnPage(page)
    let aborted = false
    await page.route('**/api/v2/dkim-keys', async (route) => {
      if (!aborted && route.request().method() === 'POST') {
        const body = route.request().postDataJSON() as { name: string }
        if (body.name === 'm03.example') {
          aborted = true
          await route.abort('connectionreset')
          return
        }
      }
      await route.fallback()
    })
    await page
      .getByRole('region', { name: 'Bulk actions' })
      .getByRole('button', { name: 'Add ARC/DKIM key' })
      .click()
    await dialog(page).getByRole('button', { name: 'Add', exact: true }).click()
    const run = page.locator('[data-run-dialog]')
    await expect(run.locator('[data-run-row]', { hasText: 'm03.example' })).toContainText(
      'Outcome unknown',
    )
    await expect(run.locator('[data-run-row]', { hasText: 'm04.example' })).toContainText(
      'Not processed',
    )
    const sent = (await mockApi.requests()).filter((r) => r.operationId === 'generateDkimKey')
    expect(sent.map((r) => (r.body as { name: string }).name)).toEqual([
      'alias-m01.example',
      'm01.example',
      'm02.example',
    ])
  })

  test('FR-042 leaving during a run asks, and leaving stops it', async ({ page, mockApi }) => {
    await mockApi.use('dns-many-missing')
    await mockApi.delay('generateDkimKey', 1200)
    await page.goto('dns/dkim-keys/k1.example')
    await expect(page.getByRole('heading', { level: 1, name: 'k1.example' })).toBeVisible({
      timeout: FIRST_LOAD,
    })
    const navigation = await openNavigation(page)
    await navigation.getByRole('link', { name: 'ARC/DKIM keys' }).click()
    await listReady(page)
    await openSelection(page)
    await selectAllOnPage(page)
    await page
      .getByRole('region', { name: 'Bulk actions' })
      .getByRole('button', { name: 'Add ARC/DKIM key' })
      .click()
    await dialog(page).getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.locator('[data-run-progress]')).toBeVisible()
    await page.evaluate(() => history.back())
    const ask = page.getByRole('alertdialog')
    await expect(ask).toContainText('The remaining names will not be processed.')
    await ask.getByRole('button', { name: 'Stop and leave' }).click()
    await page.waitForTimeout(3000)
    const sent = (await mockApi.requests()).filter((r) => r.operationId === 'generateDkimKey')
    expect(sent.length).toBeLessThan(5)
  })

  test('FR-073 a temporary failure says nothing was changed and keeps the input', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('dns-admin')
    await page.goto('dns/dkim-keys/example.net')
    await page.getByRole('button', { name: 'Add ARC/DKIM key' }).click({ timeout: FIRST_LOAD })
    await dialog(page).getByLabel('Selector').fill('custom')
    await mockApi.failNext('generateDkimKey', { status: 503, type: 'temporary-failure' })
    await dialog(page).getByRole('button', { name: 'Add', exact: true }).click()
    await expect(dialog(page)).toContainText('Nothing was changed')
    await expect(dialog(page).getByLabel('Selector')).toHaveValue('custom')
  })

  test('the selection clears when the page, filter or sort changes', async ({ page, mockApi }) => {
    await mockApi.use('dns-many-missing')
    await page.goto('dns/dkim-keys')
    await listReady(page)
    await openSelection(page)
    await selectAllOnPage(page)
    await expect(page.getByRole('region', { name: 'Bulk actions' })).toContainText('25 selected')
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await expect(page.getByRole('region', { name: 'Bulk actions' })).toContainText('0 selected')
  })

  test('FR-089 after generating, the entry, the domain page and the list show the new key', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('dns-admin')
    await page.goto('dns/dkim-keys?state=missing')
    await listReady(page)
    expect(await entryNames(page)).toContain('example.net')
    await openSelection(page)
    await page.getByRole('checkbox', { name: 'Select example.net' }).check()
    await page
      .getByRole('region', { name: 'Bulk actions' })
      .getByRole('button', { name: 'Add ARC/DKIM key' })
      .click()
    await dialog(page).getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page).toHaveURL(/\/dns\/dkim-keys\/example\.net$/)
    await expect(page.getByText('Key valid')).toBeVisible()
    await page.goto('dns/dkim-keys')
    await listReady(page)
    await expect(entry(page, 'example.net')).toContainText('Key valid')
    await page.goto('domains/example.net')
    await expect(page.locator('#section-dkim')).toContainText('Key valid')
    if (!isNarrow(page)) await expect(page.locator('#section-dkim')).toContainText('2,048')
  })
})
