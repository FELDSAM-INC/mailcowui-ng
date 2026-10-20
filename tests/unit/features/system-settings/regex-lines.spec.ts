import { describe, expect, it } from 'vitest'
import { regexLineMarks } from '@/features/system-settings/lib/regex-lines'
import { lineDiff } from '@/features/system-settings/lib/line-diff'

describe('filter map validation and change review', () => {
  it('accepts empty lines, comments, one flag, CRLF and server-only PCRE syntax', () => {
    expect(regexLineMarks('# comment\r\n\n/a/\n/a/i\n/a/m\n/a/s\n/(?>atomic)/\n/a++/\n//')).toEqual(
      [],
    )
  })
  it('names structural failures without trying to compile PCRE in JavaScript', () => {
    expect(regexLineMarks('ok\n/a/im\n/a/b/\n/[unclosed/i\n/a/x')).toEqual([
      { line: 1, reason: 'notSlashDelimited' },
      { line: 2, reason: 'tooManyFlags' },
      { line: 3, reason: 'innerSlash' },
      { line: 5, reason: 'notSlashDelimited' },
    ])
  })
  it('reviews a multiset: order does not matter, duplicates do, final newline does not', () => {
    expect(lineDiff('/a/\n/b/\n/a/\n', '/b/\n/a/\n/c/\n')).toEqual({
      added: ['/c/'],
      removed: ['/a/'],
    })
    expect(lineDiff('/a/\n/b/', '/b/\n/a/\n')).toEqual({ added: [], removed: [] })
    expect(lineDiff('', '')).toEqual({ added: [], removed: [] })
  })
  it('compares one MiB linearly', () => {
    const content = '/some-pattern-123456/\n'.repeat(50_000)
    const start = performance.now()
    expect(lineDiff(content, content + '/new/')).toEqual({ added: ['/new/'], removed: [] })
    expect(performance.now() - start).toBeLessThan(50)
  })
})

it('incremental validation stays equivalent through edits, line shifts and deletions', async () => {
  const { createRegexLineValidator } = await import('@/features/system-settings/lib/regex-lines')
  const validate = createRegexLineValidator()
  for (const content of [
    '/ok/\nbad\n/flags/im\n',
    '# added\n/ok/\nbad\n/flags/im\n',
    '# added\n/ok/\n/fixed/\n/flags/im',
    '/ok/',
    '',
    'bad\n',
    '/last/m',
  ]) {
    expect(validate(content)).toEqual(regexLineMarks(content))
  }
})
