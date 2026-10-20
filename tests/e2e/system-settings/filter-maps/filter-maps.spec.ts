import { expect, test } from '../../fixtures/test'
const mapId = 'global_mime_from_blacklist.map'
const path = `system/filter-maps/${mapId}`

test('lists lightweight summaries and fetches content only when opening a map', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('filter-maps-13')
  await page.goto('system/filter-maps')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Global filter maps')
  await expect(page.locator('main a[href*="/system/filter-maps/"]')).toHaveCount(13)
  expect(await mockApi.countRequests('getRspamdRegexMap')).toBe(0)
  await expectAccessible()
  await expectNoHorizontalScroll()
  await page.locator('#map-search').fill('Envelope Sender')
  await expect(page.locator('main a[href*="/system/filter-maps/"]')).toHaveCount(2)
  await page.getByRole('link', { name: /Envelope Sender Denylist/ }).click()
  await expect(page.locator('#regex-content')).toHaveValue('# Existing patterns\n/old.example/i\n')
  expect(await mockApi.countRequests('getRspamdRegexMap')).toBe(1)
})

test('structural marks are local, PCRE marks come from Check, and Go to line selects the failing line', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('filter-maps-13')
  await page.goto(path)
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  const content = page.locator('#regex-content')
  await content.fill('# comment\n/a/\nspam.example')
  await expect(page.getByRole('button', { name: 'Go to line 3', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Validate', exact: true }).click()
  expect(await mockApi.countRequests('replaceRspamdRegexMap')).toBe(0)
  await content.fill('# comment\n/a/\n\n\n/[unclosed/i')
  await page.getByRole('button', { name: 'Validate', exact: true }).click()
  await expect(
    page.getByText('The server could not compile this regular expression.'),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Go to line 5', exact: true }).click()
  await expect(content).toBeFocused()
  expect(
    await content.evaluate((input: HTMLTextAreaElement) =>
      input.value.slice(input.selectionStart, input.selectionEnd),
    ),
  ).toBe('/[unclosed/i')
  await expectAccessible()
  await content.fill('/a/im')
  await expect(
    page.getByText('Line 1: Use at most one flag: i, m or s.', { exact: true }),
  ).toBeVisible()
})

test('reviews additions/removals, preserves edits on cancellation, then saves with If-Match', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
  expectTouchTargets,
}) => {
  await mockApi.use('filter-maps-13')
  await page.goto(path)
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.locator('#regex-content').fill('# New patterns\n/new[.]example/i\n')
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('Added lines (2)')
  await expect(dialog).toContainText('Removed lines (2)')
  await expectAccessible()
  await expectNoHorizontalScroll()
  await expectTouchTargets()
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  expect(await mockApi.countRequests('replaceRspamdRegexMap')).toBe(0)
  await expect(page.locator('#regex-content')).toHaveValue('# New patterns\n/new[.]example/i\n')
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await dialog.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.locator('[data-map-notice]')).toContainText('no restart is needed')
  await expect(page.locator('#regex-content')).toHaveAttribute('readonly', '')
  const writes = (await mockApi.requests()).filter((r) => r.operationId === 'replaceRspamdRegexMap')
  expect(writes).toHaveLength(1)
  expect(writes[0]!.headers['if-match']).toBe('"map-0-1"')
})

test('stale versions keep the draft, fetch the new version, and require a new review', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('filter-maps-13')
  await page.goto(path)
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.locator('#regex-content').fill('/mine/i')
  await mockApi.patch({
    settings: {
      regexMaps: [
        {
          id: mapId,
          name: 'Header-From: Denylist',
          available: true,
          content: '/someone-else/i\n',
          etag: '"new-version"',
        },
      ],
    },
  })
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Save changes', exact: true })
    .click()
  await expect(page.locator('[data-outdated]')).toBeVisible()
  await expect(page.locator('#regex-content')).toHaveValue('/mine/i')
  await page.getByRole('button', { name: 'Save again', exact: true }).click()
  await expect(page.locator('[data-map-review]')).toContainText('/someone-else/i')
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Save changes', exact: true })
    .click()
  await expect(page.locator('[data-map-notice]')).toBeVisible()
  const writes = (await mockApi.requests()).filter((r) => r.operationId === 'replaceRspamdRegexMap')
  expect(writes).toHaveLength(2)
  expect(writes[1]!.headers['if-match']).toBe('"new-version"')
})

test('unavailable maps stay readable and a vanished file preserves unsaved content', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('filter-maps-13')
  await page.goto('system/filter-maps/monitoring_nolog.map')
  await expect(page.locator('[data-map-unavailable]')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0)
  await page.goto(path)
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.locator('#regex-content').fill('/keep/i')
  await mockApi.patch({
    settings: {
      regexMaps: [
        { id: mapId, name: 'Header-From: Denylist', available: false, content: '', etag: '"gone"' },
      ],
    },
  })
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Save changes', exact: true })
    .click()
  await expect(page.locator('[data-map-unavailable]')).toBeVisible()
  await expect(page.locator('#regex-content')).toHaveValue('/keep/i')
})

test('Check leaves the version unchanged; wrapping and 320px layout remain local to the editor', async ({
  page,
  mockApi,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('filter-maps-13')
  await page.goto(path)
  await page.getByRole('button', { name: 'Validate', exact: true }).click()
  await expect(page.locator('[data-map-notice]')).toHaveText('The map is valid. Nothing was saved.')
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.locator('#regex-content').fill('/' + 'a'.repeat(3000) + '/i')
  await page.setViewportSize({ width: 320, height: 720 })
  await page.getByRole('checkbox', { name: 'Wrap lines' }).uncheck()
  await expectNoHorizontalScroll()
  expect(
    await page
      .locator('#regex-content')
      .evaluate((e: HTMLTextAreaElement) => e.scrollWidth > e.clientWidth),
  ).toBe(true)
})

test('blocks oversized documents before sending and guards unsaved navigation', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('filter-maps-13')
  await page.goto(path)
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.locator('#regex-content').fill('#' + 'x'.repeat(950_000))
  await expect(page.locator('#regex-content')).not.toHaveAttribute('aria-invalid', 'true')
  await expect(page.locator('[data-code-editor] [role=status]')).toContainText('of 1 MiB')
  await page.locator('#regex-content').fill('#' + 'x'.repeat(1_048_576))
  await expect(page.locator('[data-code-editor]')).toContainText('exceeds')
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  expect(await mockApi.countRequests('replaceRspamdRegexMap')).toBe(0)
  await page.getByRole('link', { name: 'Global filter maps', exact: true }).last().click()
  await expect(page.getByRole('alertdialog')).toBeVisible()
})

test('a missing map shows the not-found state and a working return to the list', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('filter-maps-13')
  await page.goto('system/filter-maps/missing.map')
  await expect(page.getByRole('heading', { name: 'Page not found', exact: true })).toBeVisible()
  await expect(page.getByText('Global map ID missing.map invalid', { exact: true })).toBeVisible()
  await expect(page.locator('#regex-content')).toHaveCount(0)
  await page.getByRole('link', { name: 'Global filter maps', exact: true }).last().click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Global filter maps')
})

test('failed writes keep the draft and use the classic map write error with a translated reason', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('filter-maps-13')
  await page.goto(path)
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.locator('#regex-content').fill('/keep-this-draft/i')
  await page.route('**/api/v2/settings/rspamd-regex-maps/*', async (route) => {
    if (route.request().method() === 'PUT')
      await route.fulfill({
        status: 500,
        contentType: 'application/problem+json',
        body: JSON.stringify({ type: 'about:blank', title: 'Internal Server Error', status: 500 }),
      })
    else await route.continue()
  })
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Save changes', exact: true })
    .click()
  await expect(page.locator('[data-map-write-error]')).toContainText(
    `Could not write global map ID ${mapId}:`,
  )
  await expect(page.locator('[data-map-write-error]')).not.toContainText('Internal Server Error')
  await expect(page.locator('#regex-content')).toHaveValue('/keep-this-draft/i')
})

test('large change reviews scroll internally while their save and cancel actions stay visible', async ({
  page,
  mockApi,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('filter-maps-13')
  await page.goto(path)
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page
    .locator('#regex-content')
    .fill(Array.from({ length: 250 }, (_, index) => `/pattern-${index}/i`).join('\n'))
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('Added lines (250)')
  const review = page.locator('[data-map-review]')
  expect(await review.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true)
  await review.evaluate((element) => {
    element.scrollTop = element.scrollHeight
  })
  for (const name of ['Save changes', 'Cancel']) {
    const action = dialog.getByRole('button', { name, exact: true })
    await expect(action).toBeInViewport({ ratio: 1 })
  }
  await expectNoHorizontalScroll()
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  expect(await mockApi.countRequests('replaceRspamdRegexMap')).toBe(0)
})
