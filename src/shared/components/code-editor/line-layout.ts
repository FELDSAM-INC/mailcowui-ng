import { changedLines, lineAt } from './text-change'

// Logical-line geometry is cached by text at a fixed width/font/wrapping mode. The native mirror
// measures only cache misses; no full-document mirror or element per line is required.
export function measureLines(
  text: string,
  measure: (line: string) => number,
  previous: ReadonlyMap<string, number> = new Map(),
) {
  const offsets: number[] = []
  const tops: number[] = []
  const lineHeights: number[] = []
  const heights = new Map<string, number>()
  let offset = 0
  let y = 0
  for (const line of text.split('\n')) {
    offsets.push(offset)
    tops.push(y)
    const height = heights.get(line) ?? previous.get(line) ?? measure(line)
    heights.set(line, height)
    lineHeights.push(height)
    y += height
    offset += line.length + 1
  }
  return { text, offsets, tops, heights, lineHeights }
}

// Rebuild only the changed logical lines. Unchanged lines need numeric offset shifts, not
// splitting, hashing, font measurements or DOM work. The small height cache is replaced per edit.
export function updateLineLayout(
  previous: ReturnType<typeof measureLines>,
  text: string,
  measure: (line: string) => number,
): ReturnType<typeof measureLines> {
  if (text === previous.text) return previous
  const change = changedLines(previous.text, text)
  const start = lineAt(previous.offsets, change.start)
  const end =
    change.beforeEnd < previous.text.length
      ? lineAt(previous.offsets, change.beforeEnd)
      : previous.offsets.length
  const segment = measureLines(text.slice(change.start, change.afterEnd), measure, previous.heights)
  if (change.afterEnd < text.length) {
    segment.offsets.pop()
    segment.tops.pop()
    segment.lineHeights.pop()
  }
  const offsets = previous.offsets.slice(0, start)
  const tops = previous.tops.slice(0, start)
  const lineHeights = previous.lineHeights.slice(0, start)
  let y = previous.tops[start]!
  for (let index = 0; index < segment.offsets.length; index += 1) {
    offsets.push(change.start + segment.offsets[index]!)
    tops.push(y)
    lineHeights.push(segment.lineHeights[index]!)
    y += segment.lineHeights[index]!
  }
  const delta = text.length - previous.text.length
  for (let index = end; index < previous.offsets.length; index += 1) {
    offsets.push(previous.offsets[index]! + delta)
    tops.push(y)
    lineHeights.push(previous.lineHeights[index]!)
    y += previous.lineHeights[index]!
  }
  return { text, offsets, tops, lineHeights, heights: segment.heights }
}

export function lineOffsets(text: string): number[] {
  const offsets = [0]
  for (let at = text.indexOf('\n'); at !== -1; at = text.indexOf('\n', at + 1)) offsets.push(at + 1)
  return offsets
}
export function visibleLines(
  count: number,
  top: (index: number) => number,
  scroll: number,
  height: number,
) {
  let low = 0
  let high = count
  while (low < high) {
    const middle = (low + high) >>> 1
    if (top(middle) < scroll) low = middle + 1
    else high = middle
  }
  const result: { line: number; top: number }[] = []
  for (let index = Math.max(0, low - 1); index < count; index += 1) {
    const y = top(index)
    if (y > scroll + height) break
    result.push({ line: index + 1, top: y - scroll })
  }
  return result
}
