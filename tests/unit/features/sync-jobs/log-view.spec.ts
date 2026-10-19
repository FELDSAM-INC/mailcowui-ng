// The log view (UI 008 T064, data-model §2): chunks of 500 lines that join back to the exact
// input, and the states of an empty log.
import { describe, expect, it } from 'vitest'

import { chunkLog, emptyLogState, LOG_CHUNK_LINES } from '@/features/sync-jobs/log-view'

describe('chunkLog', () => {
  it('splits at line breaks into chunks that join back to the input', () => {
    expect(LOG_CHUNK_LINES).toBe(500)
    const lines = Array.from({ length: 1203 }, (_, index) => `line ${index}`)
    const input = `${lines.join('\r\n')}\n`
    const chunks = chunkLog(input)
    expect(chunks).toHaveLength(3)
    expect(chunks.join('')).toBe(input)
    expect(chunks[0]!.split('\n')).toHaveLength(501)
  })

  it('keeps an input without a trailing break, U+FFFD and an empty string', () => {
    expect(chunkLog('a\nb\uFFFD')).toEqual(['a\nb\uFFFD'])
    expect(chunkLog('')).toEqual([])
    expect(chunkLog('one line')).toEqual(['one line'])
  })
})

describe('emptyLogState', () => {
  const run = (overrides = {}) => ({
    lastRunAt: null,
    lastResult: 'unknown' as const,
    exitStatus: null,
    running: false,
    logAvailable: false,
    ...overrides,
  })

  it('tells a job that never ran from a run without output', () => {
    expect(emptyLogState(run())).toBe('never')
    expect(emptyLogState(run({ lastRunAt: '2026-10-18T07:30:00.000Z' }))).toBe('noOutput')
    expect(emptyLogState(run({ logAvailable: true }))).toBe('noOutput')
  })
})
