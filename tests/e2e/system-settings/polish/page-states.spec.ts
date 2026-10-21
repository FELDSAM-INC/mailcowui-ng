import { expect, test } from '../../fixtures/test'

// These GET states were not exercised by the per-story mutation/error tests.
for (const entry of [
  {
    name: 'Colours',
    scenario: 'brand-colours-none',
    path: 'system/customize/colours',
    endpoint: 'brand-colors',
    operation: 'getBrandColors',
    status: 503,
    ready: '#section-brand-colours',
  },
  {
    name: 'UI texts',
    scenario: 'settings-admin-defaults',
    path: 'system/customize/ui-texts',
    endpoint: 'ui-texts',
    operation: 'getUiTexts',
    status: 500,
    ready: '#section-names',
  },
  {
    name: 'global Sieve',
    scenario: 'global-sieve-default',
    path: 'system/global-sieve-filters',
    endpoint: 'global-sieve-filters',
    operation: 'listGlobalSieveFilters',
    status: 500,
    ready: '[data-global-filter=prefilter]',
  },
]) {
  test(`T167 ${entry.name}: shaped loading, translated read failure and successful retry`, async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
  }) => {
    test.setTimeout(90_000)
    await mockApi.use(entry.scenario)
    await mockApi.failNext(entry.operation, { status: entry.status })
    let release!: () => void
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    await page.route(`**/api/v2/settings/${entry.endpoint}`, async (route) => {
      await held
      await route.continue()
    })
    try {
      await page.goto(entry.path)
      const loading = page.locator('[data-settings-loading]')
      await expect(loading).toHaveAttribute('aria-busy', 'true')
      await expect(loading).toContainText('Please wait...')
      expect((await loading.boundingBox())!.height).toBeGreaterThan(160)
      await expect(loading.locator('input, textarea, button, [tabindex]')).toHaveCount(0)
      await expectAccessible()
      await expectNoHorizontalScroll()
    } finally {
      release()
    }
    const retry = page.getByRole('button', { name: 'Try again', exact: true })
    await expect(retry).toBeVisible()
    await expect(page.locator('main [role=alert]')).toContainText(
      entry.status === 500
        ? 'An unexpected server error occurred. Please contact your administrator.'
        : 'The service is temporarily unavailable. Please try again in a moment.',
    )
    await expect(page.locator('[data-settings-loading]')).toHaveCount(0)
    await expectAccessible()
    await retry.click()
    await expect(page.locator(entry.ready)).toBeVisible()
    expect(await mockApi.countRequests(entry.operation)).toBe(2)
    await expectAccessible()
  })
}
