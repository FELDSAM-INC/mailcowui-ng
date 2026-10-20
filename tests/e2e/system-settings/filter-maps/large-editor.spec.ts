import { expect, test } from '../../fixtures/test'
const id = 'global_mime_from_blacklist.map'
const path = `system/filter-maps/${id}`
const content = '# header\n' + '/example/i\n'.repeat(15_000)

test('small maps keep a native textarea and do not download the virtual editor', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('filter-maps-13')
  const downloaded: string[] = []
  page.on('request', (request) => downloaded.push(request.url()))
  await page.goto(path)
  await expect(page.locator('textarea#regex-content')).toBeVisible()
  expect(downloaded.some((url) => /LargeCodeEditor/.test(url))).toBe(false)
})

test('large maps preserve undo, Unicode input, native Tab navigation and the complete request body', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}, info) => {
  await mockApi.use('filter-maps-13')
  await mockApi.patch({
    settings: {
      regexMaps: [
        { id, name: 'Large editing map', available: true, content, etag: '"large-edit"' },
      ],
    },
  })
  await page.goto(path)
  const host = page.locator('[data-large-code-editor]')
  await expect(host).toHaveAttribute('data-editor-ready', 'true')
  const editor = page.getByRole('textbox', { name: 'Regex maps', exact: true })
  await expect(editor).toHaveAttribute('aria-readonly', 'true')
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await expect(editor).toHaveAttribute('contenteditable', 'true')
  await editor.focus()
  await editor.press('End')
  await page.keyboard.insertText(' žluťoučký 😀')
  await expect(page.locator('.cm-line').first()).toHaveText('# header žluťoučký 😀')
  await editor.press(info.project.name === 'mobile-webkit' ? 'Meta+z' : 'Control+z')
  await expect(page.locator('.cm-line').first()).toHaveText('# header')
  await page.keyboard.insertText(' nový')
  await editor.press('Tab')
  await expect(page.getByRole('checkbox', { name: 'Wrap lines', exact: true })).toBeFocused()
  await page.getByRole('button', { name: 'Validate', exact: true }).click()
  await expect(page.locator('[data-map-notice]')).toHaveText('The map is valid. Nothing was saved.')
  expect(
    (await mockApi.requests()).find((request) => request.operationId === 'replaceRspamdRegexMap')
      ?.body,
  ).toEqual({ content: content.replace('# header', '# header nový') })
  await expect(page.locator('[data-map-notice]')).toHaveText('The map is valid. Nothing was saved.')
  await page.setViewportSize({ width: 320, height: 780 })
  await expectNoHorizontalScroll()
  await expectAccessible()
})

test('large-map line navigation selects an offscreen error and editing it retains every other line', async ({
  page,
  mockApi,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('filter-maps-13')
  const invalid = content + 'spam.example'
  await mockApi.patch({
    settings: {
      regexMaps: [
        { id, name: 'Large marked map', available: true, content: invalid, etag: '"large-mark"' },
      ],
    },
  })
  await page.goto(path)
  await expect(page.locator('[data-large-code-editor]')).toHaveAttribute(
    'data-editor-ready',
    'true',
  )
  expect(await page.locator('.cm-line').count()).toBeLessThan(100)
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.getByRole('button', { name: 'Go to line 15,002', exact: true }).click()
  const editor = page.getByRole('textbox', { name: 'Regex maps', exact: true })
  await expect(editor).toBeFocused()
  await page.keyboard.insertText('/repaired/i')
  await expect(page.getByRole('button', { name: 'Go to line 15,002', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Validate', exact: true }).click()
  await expect(page.locator('[data-map-notice]')).toHaveText('The map is valid. Nothing was saved.')
  expect(
    (await mockApi.requests()).find((request) => request.operationId === 'replaceRspamdRegexMap')
      ?.body,
  ).toEqual({ content: content + '/repaired/i' })
  await page.getByRole('checkbox', { name: 'Wrap lines', exact: true }).uncheck()
  await expect(editor).not.toHaveClass(/cm-lineWrapping/)
  await page.getByRole('checkbox', { name: 'Wrap lines', exact: true }).check()
  await expect(editor).toHaveClass(/cm-lineWrapping/)
  await expectNoHorizontalScroll()
})
