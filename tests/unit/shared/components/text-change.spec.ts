import { expect, it } from 'vitest'
import { changedLines } from '@/shared/components/code-editor/text-change'

it.each([
  ['abc\ndef\nghi', 'abc\ndxef\nghi', { start: 4, beforeEnd: 8, afterEnd: 9 }],
  ['abc\ndef', 'abc\ndef\n', { start: 4, beforeEnd: 7, afterEnd: 8 }],
  ['abc\ndef', 'abc\nx\ndef', { start: 4, beforeEnd: 7, afterEnd: 9 }],
  ['abc\ndef\nghi', 'abc\nghi', { start: 4, beforeEnd: 11, afterEnd: 7 }],
  ['', 'x', { start: 0, beforeEnd: 0, afterEnd: 1 }],
  ['abc', '', { start: 0, beforeEnd: 3, afterEnd: 0 }],
])('finds complete affected logical lines for %j → %j', (before, after, expected) => {
  expect(changedLines(before, after)).toEqual(expected)
})

it('keeps a large identical suffix outside a one-character edit', () => {
  const tail = '/example/i\n'.repeat(60_000)
  expect(changedLines('/x/\n' + tail, '/xy/\n' + tail)).toEqual({
    start: 0,
    beforeEnd: 4,
    afterEnd: 5,
  })
})
