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
  expect(await editor.evaluate((input: HTMLTextAreaElement) => input.value.length)).toBe(
    content.length,
  )
  expect(Date.now() - started).toBeLessThan(2000)
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await editor.focus()
  await editor.evaluate((input: HTMLTextAreaElement) => {
    input.setSelectionRange(1, 1)
    let start = 0
    let typingSince = 0
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
    input.addEventListener('beforeinput', () => {
      start = performance.now()
      typingSince ||= start
    })
    input.addEventListener('input', () => {
      const began = start
      requestAnimationFrame(() => {
        const timings: number[] = JSON.parse(input.dataset.timings ?? '[]')
        timings.push(performance.now() - began)
        input.dataset.timings = JSON.stringify(timings)
      })
    })
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
  const longTasks: number[] = await editor.evaluate((input: HTMLTextAreaElement) =>
    JSON.parse(input.dataset.longTasks ?? '[]'),
  )
  await test.info().attach('editor-timings.json', {
    body: JSON.stringify({ timings, longTasks }),
    contentType: 'application/json',
  })
  expect(Math.max(...timings), `input-to-frame timings: ${timings.join(', ')}`).toBeLessThan(100)
  expect(
    Math.max(0, ...longTasks),
    `long tasks during typing: ${longTasks.join(', ')}`,
  ).toBeLessThan(100)
  expect(await page.locator('[data-line-gutter] > span').count()).toBeLessThan(40)
})
