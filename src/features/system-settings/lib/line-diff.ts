const lines = (content: string) => {
  if (content === '') return []
  const result = content.replace(/\r\n/g, '\n').split('\n')
  if (result.at(-1) === '') result.pop()
  return result
}
export function lineDiff(before: string, after: string): { added: string[]; removed: string[] } {
  const counts = new Map<string, number>()
  for (const line of lines(before)) counts.set(line, (counts.get(line) ?? 0) + 1)
  const added: string[] = []
  for (const line of lines(after)) {
    const count = counts.get(line) ?? 0
    if (count > 0) counts.set(line, count - 1)
    else added.push(line)
  }
  const removed: string[] = []
  for (const [line, count] of counts) for (let n = 0; n < count; n += 1) removed.push(line)
  return { added, removed }
}
