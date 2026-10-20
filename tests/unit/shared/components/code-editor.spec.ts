import { expect, it } from 'vitest'
import { lineOffsets, visibleLines } from '@/shared/components/code-editor/line-layout'
it('indexes native line starts without changing Unicode or trailing empty lines', () => {
  expect(lineOffsets('é😀\nx\n')).toEqual([0, 4, 6])
})
it('renders only visible logical lines including the wrapped line above the viewport', () => {
  let calls = 0
  const result = visibleLines(
    50_000,
    (index) => {
      calls += 1
      return index * 40
    },
    400,
    100,
  )
  expect(result).toEqual([
    { line: 10, top: -40 },
    { line: 11, top: 0 },
    { line: 12, top: 40 },
    { line: 13, top: 80 },
  ])
  expect(calls).toBeLessThan(25)
})
