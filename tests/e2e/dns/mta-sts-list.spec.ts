// UI 010 US4, the MTA-STS policies (T066, FR-054 to FR-056): paging, total, search, filters and
// sort kept in the address, cards and table, opening an entry at the domain page's MTA-STS
// section, the list states and a domain administrator's scope.
import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { entry, entryNames, FIRST_LOAD, isNarrow, listReady, resultCount } from './helpers'

const POLICIES = {
  dns: {
    policies: {
      'example.net': { mode: 'testing' as const, active: false, maxAge: 86400 },
      'shop.example': { mode: 'none' as const, active: true, maxAge: 3600 },
      'xn--bcher-kva.example': { mode: 'testing' as const, active: true, maxAge: 1209600 },
    },
  },
}

async function openList(page: Page) {
  await page.goto('dns/mta-sts-policies')
  await expect(page.getByRole('heading', { level: 1, name: 'MTA-STS' })).toBeVisible({
    timeout: FIRST_LOAD,
  })
  await listReady(page)
}

async function openFilters(page: Page) {
  const toggle = page.getByRole('button', { name: /^Filters/ })
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click()
}

test.describe('MTA-STS policies', () => {
  test('FR-054 FR-055 every policy with its values, as cards or a table', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
    expectTouchTargets,
  }) => {
    await mockApi.use('dns-mta-sts', POLICIES)
    await openList(page)
    expect(await entryNames(page)).toEqual([
      'example.net',
      'example.org',
      'shop.example',
      'xn--bcher-kva.example',
    ])
    expect(await resultCount(page)).toBe('4 policies')
    const org = entry(page, 'example.org')
    for (const value of ['Active', 'enforce', 'mail.example.org', '604,800']) {
      await expect(org).toContainText(value)
    }
    await expect(org).toContainText(/\d{14}/)
    await expect(entry(page, 'example.net')).toContainText('Inactive')
    await expect(entry(page, 'xn--bcher-kva.example')).toContainText('bücher.example')
    if (isNarrow(page)) {
      await expect(page.getByRole('list', { name: 'MTA-STS' })).toBeVisible()
      await expectTouchTargets()
    } else {
      await expect(page.getByRole('columnheader', { name: 'Domain' })).toHaveAttribute(
        'aria-sort',
        'ascending',
      )
    }
    await expectAccessible()
    await expectNoHorizontalScroll()
  })

  test('FR-054 search, filters and sort live in the address', async ({ page, mockApi }) => {
    await mockApi.use('dns-mta-sts', POLICIES)
    await openList(page)
    await page.getByRole('searchbox', { name: 'Search:' }).fill('shop')
    await expect(page).toHaveURL(/q=shop/)
    await expect.poll(() => entryNames(page)).toEqual(['shop.example'])
    await page.getByRole('button', { name: 'Clear search' }).click()
    await openFilters(page)
    await page.locator('#mta-sts-filter-mode').selectOption('testing')
    await expect(page).toHaveURL(/mode=testing/)
    await expect.poll(() => entryNames(page)).toEqual(['example.net', 'xn--bcher-kva.example'])
    await page.locator('#mta-sts-filter-active').selectOption('true')
    await expect.poll(() => entryNames(page)).toEqual(['xn--bcher-kva.example'])
    await expect(page.getByRole('button', { name: 'Filters (2)' })).toBeVisible()
    await page.reload()
    await listReady(page)
    expect(await entryNames(page)).toEqual(['xn--bcher-kva.example'])
    await openFilters(page)
    await page.locator('[data-clear-filters]').click()
    await expect.poll(async () => (await entryNames(page)).length).toBe(4)
    if (isNarrow(page)) {
      await page.locator('#mta-sts-sort').selectOption('maxAge')
    } else {
      await page.getByRole('columnheader', { name: 'Max age' }).getByRole('button').click()
    }
    await expect(page).toHaveURL(/sort=maxAge/)
    await expect
      .poll(() => entryNames(page))
      .toEqual(['shop.example', 'example.net', 'example.org', 'xn--bcher-kva.example'])
  })

  test('FR-055 opening an entry opens the domain page at its MTA-STS section', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('dns-mta-sts')
    await openList(page)
    await entry(page, 'example.org').getByRole('link').first().click()
    await expect(page).toHaveURL(/\/domains\/example\.org#mta-sts$/)
    const heading = page.locator('#mta-sts').getByRole('heading', { level: 2, name: 'MTA-STS' })
    await expect(heading).toBeFocused({ timeout: FIRST_LOAD })
    await expect(heading).toBeInViewport()
  })

  test('FR-056 no policies, no matches and an error with retry', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('dns-admin')
    await openList(page)
    const empty = page.locator('[data-mta-sts-empty]')
    await expect(empty).toContainText('Policies are set up on the page of a domain.')
    await expect(empty.getByRole('link', { name: 'Domains' })).toBeVisible()
    await expectAccessible()
    await mockApi.use('dns-mta-sts')
    await page.goto('dns/mta-sts-policies?q=nothing-like-this')
    await expect(page.getByText('No matching records found')).toBeVisible({ timeout: FIRST_LOAD })
    await page.getByRole('button', { name: 'Clear all filters' }).click()
    await expect.poll(() => entryNames(page)).toEqual(['example.org'])
    await mockApi.failNext('listMtaStsPolicies', { status: 500 })
    await page.goto('dns/mta-sts-policies?mode=enforce')
    await expect(page.getByText('The list could not be loaded.')).toBeVisible()
    await page.getByRole('button', { name: 'Try again' }).click()
    await expect.poll(() => entryNames(page)).toEqual(['example.org'])
  })

  test('FR-054 a domain administrator sees only the policies of their domains', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('dns-mta-sts', { ...POLICIES, signedInAs: 'reseller' })
    await openList(page)
    expect(await entryNames(page)).toEqual(['example.net', 'example.org'])
  })
})
