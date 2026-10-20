// Find complete changed logical lines without walking an unchanged MiB-sized suffix in JS.
// Strings and textarea selection offsets use UTF-16; boundaries here always fall after LF.
export function changedLines(before: string, after: string) {
  let low = 0
  let high = Math.min(before.length, after.length)
  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    if (before.slice(0, middle) === after.slice(0, middle)) low = middle
    else high = middle - 1
  }
  const prefix = low
  low = 0
  high = Math.min(before.length, after.length) - prefix
  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    if (before.slice(before.length - middle) === after.slice(after.length - middle)) low = middle
    else high = middle - 1
  }
  const start = prefix === 0 ? 0 : before.lastIndexOf('\n', prefix - 1) + 1
  const newline = before.indexOf('\n', before.length - low)
  const beforeEnd = newline === -1 ? before.length : newline + 1
  return { start, beforeEnd, afterEnd: after.length - (before.length - beforeEnd) }
}

export function lineAt(offsets: readonly number[], offset: number) {
  let low = 0
  let high = offsets.length
  while (low < high) {
    const middle = (low + high) >>> 1
    if (offsets[middle]! <= offset) low = middle + 1
    else high = middle
  }
  return Math.max(0, low - 1)
}
