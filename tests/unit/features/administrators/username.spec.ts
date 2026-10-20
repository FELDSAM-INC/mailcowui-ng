import { expect, it } from 'vitest'
import { normaliseUsername, validateUsername } from '@/features/administrators/username'
it('normalises only surrounding whitespace and letter case', () => {
  expect(normaliseUsername(' Reseller.One ')).toBe('reseller.one')
})
it.each(['api', 'API', 'Api'])('rejects reserved %s', (value) => {
  expect(validateUsername(value)).toMatchObject({ code: 'reserved' })
})
it.each(['...', '_-', 'a b', 'user@host', 'čtenář'])('rejects invalid %s', (value) => {
  expect(validateUsername(value)).toMatchObject({
    code: 'invalidFormat',
    params: { format: 'accountUsername' },
  })
})
it('requires a value and observes the server limit', () => {
  expect(validateUsername(' ')).toMatchObject({ code: 'required' })
  expect(validateUsername('abcd', 3)).toMatchObject({ code: 'tooLong', params: { max: 3 } })
  expect(validateUsername(' Reseller.1 ')).toBeNull()
})
