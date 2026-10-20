import { expect, test } from '../../fixtures/test'
test('one MiB editor opens promptly and typed characters appear without input lag', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('filter-maps-13')
  const id = 'global_mime_from_blacklist.map'
  const pattern = '/example[.]org/i\n'
  const lines = pattern.repeat(Math.floor(1_048_554 / pattern.length))
  const content = lines + '#' + 'x'.repeat(1_048_555 - lines.length - 1)
  await mockApi.patch({
    settings: {
      regexMaps: [{ id, name: 'Large map', available: true, content, etag: '"large-map"' }],
    },
  })
  await page.goto('system/filter-maps')
  await expect(page.getByRole('link', { name: /Large map/ })).toBeVisible()
  const started = Date.now()
  await page.getByRole('link', { name: /Large map/ }).click()
  const editor = page.locator('#regex-content')
  await editor.waitFor({ state: 'visible' })
  const native = await editor.evaluate((element) => element instanceof HTMLTextAreaElement)
  if (native)
    expect(await editor.evaluate((input: HTMLTextAreaElement) => input.value.length)).toBe(
      content.length,
    )
  else
    await expect(page.locator('[data-large-code-editor]')).toHaveAttribute(
      'data-editor-ready',
      'true',
    )
  expect(Date.now() - started).toBeLessThan(2000)
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await editor.focus()
  if (!native) {
    await editor.press('Home')
    await editor.press('ArrowRight')
  }
  await editor.evaluate((input: HTMLElement) => {
    if (input instanceof HTMLTextAreaElement) input.setSelectionRange(1, 1)
    let typingSince = 0
    let typed = ''
    if (PerformanceObserver.supportedEntryTypes.includes('longtask')) {
      const observer = new PerformanceObserver((entries) => {
        const tasks: number[] = JSON.parse(input.dataset.longTasks ?? '[]')
        tasks.push(
          ...entries
            .getEntries()
            .filter((entry) => typingSince > 0 && entry.startTime + entry.duration >= typingSince)
            .map((entry) => entry.duration),
        )
        input.dataset.longTasks = JSON.stringify(tasks)
      })
      observer.observe({ type: 'longtask' })
    }
    input.addEventListener(
      'beforeinput',
      (event) => {
        typed += event.data ?? ''
        const expectedPrefix = '/' + typed
        const began = performance.now()
        typingSince ||= began
        requestAnimationFrame(() => {
          const timings: number[] = JSON.parse(input.dataset.timings ?? '[]')
          timings.push(performance.now() - began)
          const visible: boolean[] = JSON.parse(input.dataset.visibleFrames ?? '[]')
          const value = input instanceof HTMLTextAreaElement ? input.value : input.textContent
          visible.push(value?.startsWith(expectedPrefix) ?? false)
          input.dataset.visibleFrames = JSON.stringify(visible)
          input.dataset.timings = JSON.stringify(timings)
        })
      },
      { capture: true },
    )
  })
  await page.keyboard.type('abcdefghij', { delay: 50 })
  await expect
    .poll(() =>
      editor.evaluate(
        (input: HTMLTextAreaElement) => JSON.parse(input.dataset.timings ?? '[]').length,
      ),
    )
    .toBe(10)
  const timings: number[] = await editor.evaluate((input: HTMLTextAreaElement) =>
    JSON.parse(input.dataset.timings!),
  )
  const visibleFrames: boolean[] = await editor.evaluate((input: HTMLElement) =>
    JSON.parse(input.dataset.visibleFrames ?? '[]'),
  )
  const longTasks: number[] = await editor.evaluate((input: HTMLTextAreaElement) =>
    JSON.parse(input.dataset.longTasks ?? '[]'),
  )
  await test.info().attach('editor-timings.json', {
    body: JSON.stringify({
      timings,
      longTasks,
      visibleFrames,
    }),
    contentType: 'application/json',
  })
  expect(visibleFrames).toEqual(Array<boolean>(10).fill(true))
  expect(Math.max(...timings), `input-to-frame timings: ${timings.join(', ')}`).toBeLessThan(100)
  expect(
    Math.max(0, ...longTasks),
    `long tasks during typing: ${longTasks.join(', ')}`,
  ).toBeLessThan(100)
  expect(await page.locator('[data-line-gutter] > span, .cm-gutterElement').count()).toBeLessThan(
    80,
  )
  await page.getByRole('button', { name: 'Validate', exact: true }).click()
  await expect(page.locator('[data-map-notice]')).toHaveText('The map is valid. Nothing was saved.')
  const request = (await mockApi.requests()).find(
    (request) => request.operationId === 'replaceRspamdRegexMap',
  )
  expect(request?.body).toEqual({ content: '/abcdefghij' + content.slice(1) })
})
