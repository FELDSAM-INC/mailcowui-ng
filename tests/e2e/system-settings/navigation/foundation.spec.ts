import { expect, test } from '../../fixtures/test'

test('FR-001/FR-042 administrator opens settings and saves the IP check with legacy wording', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
  expectTouchTargets,
}) => {
  await mockApi.use('settings-admin-defaults')
  await page.goto('system')
  await expect(page.getByRole('heading', { level: 1, name: 'System settings' })).toBeVisible()
  await expectAccessible()
  await expectNoHorizontalScroll()
  await expectTouchTargets()
  await page
    .locator('[data-settings-overview]')
    .getByRole('link', { name: /IP Check/ })
    .click()
  await expect(page.getByRole('heading', { level: 1, name: 'IP Check' })).toBeVisible()
  await expect(page.locator('[data-ip-check-value]')).toHaveText('No')
  await page.getByRole('button', { name: 'Edit IP Check' }).click()
  await expect(page.locator('[data-ip-check-form] strong')).not.toHaveCount(0)
  await page.getByRole('checkbox').check()
  await expectAccessible()
  await expectTouchTargets()
  await expectNoHorizontalScroll()
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.locator('[data-ip-check-value]')).toHaveText('Yes')
  await expect(page.getByRole('status').filter({ hasText: /IP check/ })).toBeVisible()
  const write = (await mockApi.requests()).find(
    (request) => request.operationId === 'updateIpCheckSetting',
  )!
  expect(write.body).toEqual({ enabled: true })
  expect(write.headers['if-match']).toBe('"ip-check-1"')
  await expectAccessible()
})

for (const scenario of ['settings-domain-admin', 'settings-mailbox-user']) {
  test(`FR-001 ${scenario} cannot open settings or send settings requests`, async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use(scenario)
    for (const path of ['system', 'system/ip-check']) {
      await page.goto(path)
      await expect(page.getByRole('heading', { name: 'No access' })).toBeVisible()
      await expectAccessible()
    }
    expect(
      (await mockApi.requests()).filter((request) =>
        /SettingsCapabilities|IpCheckSetting/.test(request.operationId ?? ''),
      ),
    ).toEqual([])
  })
}

test('FR-032 failed capabilities can be retried before a page reads its settings', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('settings-capabilities-error')
  await page.goto('system/ip-check')
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
  expect(await mockApi.countRequests('getIpCheckSetting')).toBe(0)
  await expectAccessible()
  await mockApi.patch({ failures: { getSettingsCapabilities: { status: 500, times: 0 } } })
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.locator('[data-ip-check-value]')).toHaveText('No')
})

test('FR-017 demo mode shows the IP check read-only', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('settings-demo-mode')
  await page.goto('system/ip-check')
  await expect(page.locator('[data-demo-mode]')).toBeVisible()
  await expect(page.locator('[data-ip-check-value]')).toHaveText('No')
  await expect(page.getByRole('button', { name: 'Edit IP Check' })).toHaveCount(0)
  await expectAccessible()
  await expectNoHorizontalScroll()
})

test('FR-011/FR-013 stale save preserves the draft and leaving asks before discarding', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('settings-admin-defaults')
  await page.goto('system/ip-check')
  await page.getByRole('button', { name: 'Edit IP Check' }).click()
  await page.getByRole('checkbox').check()
  await mockApi.patch({ settings: { ipCheck: { etag: '"changed-elsewhere"' } } })
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.locator('[data-outdated]')).toBeVisible()
  await expect(page.getByRole('checkbox')).toBeChecked()
  await expectAccessible()
  await page.getByRole('button', { name: 'Save again', exact: true }).click()
  await expect(page.locator('[data-ip-check-value]')).toHaveText('Yes')
  await page.getByRole('button', { name: 'Edit IP Check' }).click()
  await page.getByRole('checkbox').uncheck()
  await page.getByRole('link', { name: 'System settings', exact: true }).last().click()
  await expect(page.getByRole('alertdialog')).toBeVisible()
  await expectAccessible()
})
