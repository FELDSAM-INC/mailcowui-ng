// T046: classification of the captured return (data-model §2, research R6).
import { describe, expect, it } from 'vitest'

import { classifyReturn } from '@/features/auth/sso/return-classify'

describe('classifyReturn', () => {
  it('completes with a code and a state', () => {
    expect(classifyReturn({ code: 'c', state: 's' })).toEqual({
      kind: 'complete',
      code: 'c',
      state: 's',
    })
    expect(classifyReturn({ code: 'c'.repeat(4096), state: 's'.repeat(512) }).kind).toBe('complete')
  })

  it('reports a provider error with a state when the code fits the contract pattern', () => {
    expect(classifyReturn({ error: 'access_denied', state: 's' })).toEqual({
      kind: 'providerError',
      error: 'access_denied',
      state: 's',
    })
    expect(classifyReturn({ error: 'access_denied', state: 's', code: 'c' }).kind).toBe(
      'providerError',
    )
  })

  it('cancels a provider error it cannot report', () => {
    for (const captured of [
      { error: 'access_denied' },
      { error: 'bad"quote', state: 's' },
      { error: 'back\\slash', state: 's' },
      { error: 'e'.repeat(65), state: 's' },
      { error: '', state: 's' },
      { error: 'access_denied', state: 's'.repeat(513) },
    ]) {
      expect(classifyReturn(captured).kind, JSON.stringify(captured)).toBe(
        'providerErrorUnreportable',
      )
    }
  })

  it('treats one of code and state, or an over-long value, as malformed', () => {
    for (const captured of [
      { code: 'c' },
      { state: 's' },
      { code: '', state: 's' },
      { code: 'c'.repeat(4097), state: 's' },
      { code: 'c', state: 's'.repeat(513) },
    ]) {
      expect(classifyReturn(captured).kind, JSON.stringify(captured)).toBe('malformed')
    }
  })

  it('is empty without parameters or without a capture', () => {
    expect(classifyReturn({}).kind).toBe('empty')
    expect(classifyReturn(null).kind).toBe('empty')
  })
})
