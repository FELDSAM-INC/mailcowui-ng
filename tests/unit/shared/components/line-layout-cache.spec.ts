import { expect, it, vi } from 'vitest'
import { measureLines, visibleLines } from '@/shared/components/code-editor/line-layout'

it('measures repeated logical lines once and reuses their heights after an edit', () => {
  const measure = vi.fn((line: string) => (line.length > 10 ? 48 : 24))
  const text = '/example/i\n'.repeat(60_000)
  const first = measureLines(text, measure)
  expect(measure).toHaveBeenCalledTimes(2)
  expect(first.tops[60_000]).toBe(60_000 * 24)
  measure.mockClear()
  const changed = measureLines('/longer-example/i\n' + text, measure, first.heights)
  expect(measure).toHaveBeenCalledExactlyOnceWith('/longer-example/i')
  expect(changed.tops[1]).toBe(48)
  expect(changed.offsets[1]).toBe('/longer-example/i\n'.length)
  expect(
    visibleLines(changed.tops.length, (index) => changed.tops[index]!, 24_000, 336),
  ).toHaveLength(16)
})

it('handles inserted/deleted lines and prunes heights of text no longer present', () => {
  const measure = vi.fn((line: string) => (line === 'wrapped' ? 72 : 24))
  const initial = measureLines('one\nwrapped\nthree\n', measure)
  expect(initial.offsets).toEqual([0, 4, 12, 18])
  expect(initial.tops).toEqual([0, 24, 96, 120])
  measure.mockClear()
  const changed = measureLines('one\nthree\n', measure, initial.heights)
  expect(changed.offsets).toEqual([0, 4, 10])
  expect(changed.tops).toEqual([0, 24, 48])
  expect(changed.heights.has('wrapped')).toBe(false)
  expect(measure).not.toHaveBeenCalled()
})

it('remeasures every distinct line after the geometry cache is discarded', () => {
  const first = measureLines('wide\nwide\nshort', () => 24)
  const narrower = measureLines('wide\nwide\nshort', (line) => (line === 'wide' ? 48 : 24))
  expect(first.tops).toEqual([0, 24, 48])
  expect(narrower.tops).toEqual([0, 48, 96])
})

it('updates only affected lines and shifts cached offsets/heights for the untouched suffix', async () => {
  const { updateLineLayout } = await import('@/shared/components/code-editor/line-layout')
  const initial = measureLines('one\nwrapped\nthree\n', (line) => (line === 'wrapped' ? 72 : 24))
  const measure = vi.fn(() => 48)
  const changed = updateLineLayout(initial, 'one\ninserted\nwrapped\nthree\n', measure)
  expect(changed.offsets).toEqual([0, 4, 13, 21, 27])
  expect(changed.tops).toEqual([0, 24, 72, 144, 168])
  expect(measure).toHaveBeenCalledExactlyOnceWith('inserted')
  expect([...changed.heights.keys()]).toEqual(['inserted', 'wrapped', ''])
})

it('incremental geometry matches complete measurement through line splits, merges and deletion', async () => {
  const { updateLineLayout } = await import('@/shared/components/code-editor/line-layout')
  const measure = (line: string) => (line.length > 8 ? 48 : 24)
  let layout = measureLines('', measure)
  for (const text of [
    'a\nb',
    'a\nlonger line\nb',
    'a\nlonger line\nb\n',
    'a\nlonger lineb\n',
    '',
    '\n',
    'final',
  ]) {
    layout = updateLineLayout(layout, text, measure)
    const expected = measureLines(text, measure)
    expect(layout.offsets).toEqual(expected.offsets)
    expect(layout.tops).toEqual(expected.tops)
    expect(layout.lineHeights).toEqual(expected.lineHeights)
  }
})
