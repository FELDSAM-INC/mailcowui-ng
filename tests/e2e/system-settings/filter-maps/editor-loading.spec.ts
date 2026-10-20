import { expect, test } from '../../fixtures/test'

test('large editor announces a slow download and recovers from a failed chunk with the native editor', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('filter-maps-13')
  const id = 'global_mime_from_blacklist.map'
  await mockApi.patch({
    settings: {
      regexMaps: [
        {
          id,
          name: 'Large map',
          available: true,
          content: '/x/\n'.repeat(40_000),
          etag: '"large"',
        },
      ],
    },
  })
  let release: () => void = () => {}
  const blocked = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/LargeCodeEditor-*.js', async (route) => {
    await blocked
    await route.abort('failed')
  })
  await page.goto(`system/filter-maps/${id}`)
  try {
    await expect(page.locator('[data-editor-loading]')).toBeVisible()
    await expect(page.locator('[data-editor-loading]')).toHaveAttribute('aria-busy', 'true')
  } finally {
    release()
  }
  await expect(page.locator('[data-editor-load-error]')).toBeVisible()
  await page.getByRole('button', { name: 'Use basic editor', exact: true }).click()
  const editor = page.locator('textarea#regex-content')
  await expect(editor).toHaveValue('/x/\n'.repeat(40_000))
  await expect(editor).toHaveAttribute('readonly', '')
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await editor.fill('/recovered/i')
  await page.getByRole('button', { name: 'Validate', exact: true }).click()
  await expect(page.locator('[data-map-notice]')).toHaveText('The map is valid. Nothing was saved.')
  expect(
    (await mockApi.requests()).find((request) => request.operationId === 'replaceRspamdRegexMap')
      ?.body,
  ).toEqual({ content: '/recovered/i' })
})
