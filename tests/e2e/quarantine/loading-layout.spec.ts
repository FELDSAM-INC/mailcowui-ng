import { expect, test } from '../fixtures/test'

test('slow settings and message reads keep the search position and footer stable', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('quarantine-mailbox-user')
  let releaseSettings!: () => void
  let releaseItems!: () => void
  const settingsReady = new Promise<void>((resolve) => (releaseSettings = resolve))
  const itemsReady = new Promise<void>((resolve) => (releaseItems = resolve))
  await page.route('**/api/v2/quarantine/settings', async (route) => {
    const response = await route.fetch()
    await settingsReady
    await route.fulfill({ response })
  })
  await page.route('**/api/v2/quarantine?*', async (route) => {
    const response = await route.fetch()
    await itemsReady
    await route.fulfill({ response })
  })
  try {
    await page.goto('quarantine')
    const search = page.locator('#quarantine-search')
    await expect(search).toBeVisible()
    const before = await search.boundingBox()
    expect(before).not.toBeNull()
    await expect(page.getByRole('contentinfo')).not.toBeInViewport()
    releaseSettings()
    await expect(page.locator('[data-quarantine-active]')).toBeVisible()
    const after = await search.boundingBox()
    expect(Math.abs(after!.y - before!.y)).toBeLessThanOrEqual(1)
    releaseItems()
    await expect(page.locator('[data-quarantine-item]')).toHaveCount(25)
    expect(
      (await mockApi.requests()).filter(
        (request) => request.operationId === 'getQuarantineSettings',
      ),
    ).toHaveLength(1)
  } finally {
    releaseSettings()
    releaseItems()
  }
})
