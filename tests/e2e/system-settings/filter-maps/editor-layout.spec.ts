import type { Page } from '@playwright/test'
import { expect, test } from '../../fixtures/test'

// Compare against native browser wrapping on a small reference document. Production only
// measures individual uncached lines; this full-document reference exists in this test alone.
async function gutterError(page: Page): Promise<number> {
  return page.locator('#regex-content').evaluate((element: HTMLTextAreaElement) => {
    const gutter = element.parentElement!.querySelector('[data-line-gutter]')!
    const spans = [...gutter.querySelectorAll('span')]
    if (!spans.length) return 1_000_000
    const style = getComputedStyle(element)
    const reference = document.createElement('div')
    Object.assign(reference.style, {
      position: 'absolute',
      visibility: 'hidden',
      pointerEvents: 'none',
      top: '0',
      left: '0',
      boxSizing: 'border-box',
      width: `${element.clientWidth}px`,
      padding: style.padding,
      font: style.font,
      letterSpacing: style.letterSpacing,
      lineHeight: style.lineHeight,
      whiteSpace: element.wrap === 'off' ? 'pre' : 'pre-wrap',
      overflowWrap: 'break-word',
      tabSize: style.tabSize,
    })
    const text = document.createTextNode(element.value + '\u200b')
    reference.append(text)
    document.body.append(reference)
    const offsets = [0]
    for (let at = element.value.indexOf('\n'); at !== -1; at = element.value.indexOf('\n', at + 1))
      offsets.push(at + 1)
    try {
      const measurements = spans.map((span) => {
        const index = Number(span.textContent) - 1
        const range = document.createRange()
        range.setStart(text, offsets[index]!)
        range.setEnd(text, offsets[index]! + 1)
        const expected =
          range.getBoundingClientRect().top -
          reference.getBoundingClientRect().top -
          element.scrollTop
        range.selectNodeContents(span)
        const actual = range.getBoundingClientRect().top - gutter.getBoundingClientRect().top
        return { line: index + 1, expected, actual, error: Math.abs(expected - actual) }
      })
      element.dataset.layoutMeasurements = JSON.stringify(measurements)
      return Math.max(...measurements.map((item) => item.error))
    } finally {
      reference.remove()
    }
  })
}

test('cached line heights track wrapping, Unicode, blank lines, edits and scrolling', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('filter-maps-13')
  const content =
    [
      '/short/i',
      '',
      '/long-pattern-'.repeat(28) + '/',
      '# words and spaces '.repeat(20),
      '# žluťoučký 😀 '.repeat(18),
      '#\ttabbed\tcontent',
      ...Array.from({ length: 20 }, (_, index) => `/line-${index}/`),
    ].join('\n') + '\n'
  await mockApi.patch({
    settings: {
      regexMaps: [
        {
          id: 'global_mime_from_blacklist.map',
          name: 'Layout map',
          available: true,
          content,
          etag: '"layout"',
        },
      ],
    },
  })
  await page.goto('system/filter-maps/global_mime_from_blacklist.map')
  const editor = page.locator('#regex-content')
  await expect(editor).toHaveValue(content)
  await expect.poll(() => gutterError(page)).toBeLessThan(1.1)
  await editor.evaluate((element: HTMLTextAreaElement) => {
    element.scrollTop = 240
    element.dispatchEvent(new Event('scroll'))
  })
  await expect.poll(() => gutterError(page)).toBeLessThan(1.1)
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await editor.fill('/inserted/\n' + content)
  await expect.poll(() => gutterError(page)).toBeLessThan(1.1)
  await page.getByRole('checkbox', { name: 'Wrap lines', exact: true }).uncheck()
  await expect.poll(() => gutterError(page)).toBeLessThan(1.1)
  await page.getByRole('checkbox', { name: 'Wrap lines', exact: true }).check()
  await page.setViewportSize({ width: 320, height: 780 })
  await expect.poll(() => gutterError(page)).toBeLessThan(1.1)
  await expectAccessible()
})

test.afterEach(async ({ page }, info) => {
  if (info.status !== info.expectedStatus)
    await info.attach('gutter-measurements.json', {
      body: (await page.locator('#regex-content').getAttribute('data-layout-measurements')) ?? '[]',
      contentType: 'application/json',
    })
})
