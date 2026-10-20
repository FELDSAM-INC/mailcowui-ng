import { changedLines } from '@/shared/components/code-editor/text-change'

// Structural checks only: PCRE compilation belongs to the server, never JavaScript RegExp.
export type RegexLineReason = 'notSlashDelimited' | 'tooManyFlags' | 'innerSlash'
export function regexLineMarks(content: string): { line: number; reason: RegexLineReason }[] {
  const marks: { line: number; reason: RegexLineReason }[] = []
  for (const [index, raw] of content.split('\n').entries()) {
    const line = raw.replace(/\r$/, '')
    if (line === '' || line.startsWith('#')) continue
    const last = line.lastIndexOf('/')
    const flags = line.slice(last + 1)
    let reason: RegexLineReason | undefined
    if (!line.startsWith('/') || last <= 0) reason = 'notSlashDelimited'
    else if (flags.length > 1 && /^[a-z]+$/i.test(flags)) reason = 'tooManyFlags'
    else if (flags !== '' && !/^[ims]$/.test(flags)) reason = 'notSlashDelimited'
    else if (line.slice(1, last).includes('/')) reason = 'innerSlash'
    if (reason) marks.push({ line: index + 1, reason })
  }
  return marks
}

// Retain marks outside an edit; revalidate only complete affected lines. This remains synchronous,
// so Save and line errors always reflect the current text without rescanning every PCRE per key.
export function createRegexLineValidator() {
  let previous = ''
  let marks: ReturnType<typeof regexLineMarks> = []
  const countLines = (text: string, end = text.length) => {
    let count = 0
    for (let at = text.indexOf('\n'); at !== -1 && at < end; at = text.indexOf('\n', at + 1))
      count += 1
    return count
  }
  return (content: string) => {
    if (content === previous) return marks
    const { start, beforeEnd, afterEnd } = changedLines(previous, content)
    const first = countLines(previous, start) + 1
    const before = previous.slice(start, beforeEnd)
    const after = content.slice(start, afterEnd)
    const removed = countLines(before)
    const delta = countLines(after) - removed
    const end = beforeEnd < previous.length ? first + removed : Infinity
    marks = [
      ...marks.filter((mark) => mark.line < first),
      ...regexLineMarks(after).map((mark) => ({ ...mark, line: mark.line + first - 1 })),
      ...marks
        .filter((mark) => mark.line >= end)
        .map((mark) => ({ ...mark, line: mark.line + delta })),
    ]
    previous = content
    return marks
  }
}
