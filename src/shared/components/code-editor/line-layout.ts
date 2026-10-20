// A single inert mirror lets the browser measure native textarea wrapping. Only visible line
// numbers are rendered. Offset lookup is logarithmic; no element is created for every line.
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
