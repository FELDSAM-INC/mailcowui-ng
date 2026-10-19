// UI 006 T083 (research R19, data-model §7): an allow or block list pattern is trimmed and
// lower-cased, then checked against the capabilities' rules before anything is sent.
import { describe, expect, it } from 'vitest'

import { normalisePattern, patternError } from '@/features/spam-filter/pattern'

const RULES = { maxLength: 100, allowedCharacters: 'a-z0-9@_.*-', wildcard: '*' }

describe('normalisePattern', () => {
  it('trims and lower-cases', () => {
    expect(normalisePattern('  *@Spam.Example ')).toBe('*@spam.example')
    expect(normalisePattern('\tNews@Example.ORG\n')).toBe('news@example.org')
  })
})

describe('patternError', () => {
  it('accepts patterns of the allowed characters with a letter or digit', () => {
    for (const pattern of ['*@spam.example', 'news@example.org', 'a', '*.example', 'x_y-z@*']) {
      expect(patternError(pattern, RULES), pattern).toBeNull()
    }
  })

  it('refuses an empty pattern', () => {
    expect(patternError('', RULES)).toBe('required')
  })

  it('refuses characters outside the class, such as + and spaces', () => {
    expect(patternError('user+tag@example.org', RULES)).toBe('invalidFormat')
    expect(patternError('a b@example.org', RULES)).toBe('invalidFormat')
    expect(patternError('Upper@example.org', RULES)).toBe('invalidFormat')
  })

  it('refuses wildcards and punctuation only', () => {
    expect(patternError('*', RULES)).toBe('invalidFormat')
    expect(patternError('*@*', RULES)).toBe('invalidFormat')
    expect(patternError('._-', RULES)).toBe('invalidFormat')
  })

  it('refuses more characters than the maximum', () => {
    expect(patternError(`${'a'.repeat(95)}@x.de`, RULES)).toBeNull()
    expect(patternError(`${'a'.repeat(96)}@x.de`, RULES)).toBe('tooLong')
  })

  it('takes the character class and the maximum from the capabilities', () => {
    const rules = { maxLength: 5, allowedCharacters: 'a-c]\\', wildcard: '*' }
    expect(patternError('abc', rules)).toBeNull()
    expect(patternError('ab]', rules)).toBeNull()
    expect(patternError('abd', rules)).toBe('invalidFormat')
    expect(patternError('abcabc', rules)).toBe('tooLong')
  })
})
