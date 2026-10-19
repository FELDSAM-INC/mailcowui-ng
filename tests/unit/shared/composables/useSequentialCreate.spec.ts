// One request per entry (T019, UI 004 data-model §7, research R9): strictly one at a time, in
// order; entry-level refusals continue and form-level ones stop; a network failure stops the run;
// the progress is exposed and nothing is retried. UI 010 (T015, research R8): the entry in flight
// when the connection drops (or a non-problem 5xx answers) ends `unknown`, and `stop()` lets the
// current request finish and leaves the rest not processed.
import { describe, expect, it, vi } from 'vitest'

import { ApiProblem } from '@/api'
import { useSequentialCreate } from '@/shared/composables/useSequentialCreate'
import { parseEntryList } from '@/shared/validation/entry-list'

const problem = (name: string, status = 409) =>
  ApiProblem.fromParts({ kind: 'problem', type: `/api/v2/problems/${name}`, status })
const network = () => ApiProblem.fromParts({ kind: 'network' })
const classify = (p: ApiProblem): 'entry' | 'form' => (p.is('address-in-use') ? 'entry' : 'form')

describe('useSequentialCreate', () => {
  it('sends one request at a time, in order, and continues after an entry-level refusal', async () => {
    const run = useSequentialCreate<{ id: number }>()
    const log: string[] = []
    let inFlight = 0
    const send = vi.fn(async (value: string) => {
      inFlight += 1
      expect(inFlight).toBe(1)
      log.push(`start ${value}`)
      await Promise.resolve()
      log.push(`end ${value}`)
      inFlight -= 1
      if (value === 'sales@example.org') throw problem('address-in-use')
      return { id: log.length }
    })
    const results = await run.run(
      parseEntryList('info@example.org sales@example.org office@example.org'),
      (entry) => send(entry.value),
      classify,
    )
    expect(log).toEqual([
      'start info@example.org',
      'end info@example.org',
      'start sales@example.org',
      'end sales@example.org',
      'start office@example.org',
      'end office@example.org',
    ])
    expect(results.map((result) => result.outcome)).toEqual(['created', 'refused', 'created'])
    expect(results[1]!.problem?.is('address-in-use')).toBe(true)
    expect(run.status.value).toBe('done')
    expect(run.stopProblem.value).toBeNull()
  })

  it('stops at a form-level refusal and marks the rest not processed', async () => {
    const run = useSequentialCreate()
    const send = vi.fn((value: string) =>
      value === 'b@example.org'
        ? Promise.reject(problem('validation-failed', 422))
        : Promise.resolve(value),
    )
    const results = await run.run(
      parseEntryList('a@example.org b@example.org c@example.org'),
      (entry) => send(entry.value),
      classify,
    )
    expect(results.map((result) => result.outcome)).toEqual(['created', 'refused', 'notProcessed'])
    expect(send).toHaveBeenCalledTimes(2)
    expect(run.status.value).toBe('stopped')
    expect(run.stopProblem.value?.is('validation-failed')).toBe(true)
  })

  it('stops after a network failure: the entry in flight is unknown, the rest not processed, nothing is retried', async () => {
    const run = useSequentialCreate()
    const send = vi.fn((value: string) =>
      value === 'b@example.org' ? Promise.reject(network()) : Promise.resolve(value),
    )
    const results = await run.run(
      parseEntryList('a@example.org b@example.org c@example.org'),
      (entry) => send(entry.value),
      classify,
    )
    expect(results.map((result) => result.outcome)).toEqual([
      'created',
      'unknown',
      'notProcessed',
    ])
    expect(results[1]!.problem?.kind).toBe('network')
    expect(send).toHaveBeenCalledTimes(2)
    expect(run.status.value).toBe('stopped')
    expect(run.stopProblem.value?.kind).toBe('network')
  })

  it('treats a non-problem 5xx like a dropped connection', async () => {
    const run = useSequentialCreate()
    const unavailable = ApiProblem.fromParts({ kind: 'unavailable', status: 502 })
    const results = await run.run(
      parseEntryList('a b'),
      (entry) => (entry.value === 'a' ? Promise.reject(unavailable) : Promise.resolve(entry.value)),
      classify,
    )
    expect(results.map((result) => result.outcome)).toEqual(['unknown', 'notProcessed'])
    expect(run.stopProblem.value?.kind).toBe('unavailable')
  })

  it('stop() lets the current request finish and leaves the rest not processed', async () => {
    const run = useSequentialCreate<string>()
    let release!: () => void
    const send = vi.fn(async (value: string) => {
      if (value === 'a') await new Promise<void>((resolve) => (release = resolve))
      return value
    })
    const promise = run.run(parseEntryList('a b c'), (entry) => send(entry.value), classify)
    await Promise.resolve()
    run.stop()
    release()
    const results = await promise
    expect(results.map((result) => result.outcome)).toEqual([
      'created',
      'notProcessed',
      'notProcessed',
    ])
    expect(send).toHaveBeenCalledTimes(1)
    expect(run.status.value).toBe('stopped')
    expect(run.stopProblem.value).toBeNull()
  })

  it('exposes the pending state and the progress', async () => {
    const run = useSequentialCreate()
    let release!: () => void
    const progress: string[] = []
    const promise = run.run(
      parseEntryList('a b c'),
      async (entry) => {
        progress.push(`${run.current.value} of ${run.total.value}`)
        if (entry.value === 'b') await new Promise<void>((resolve) => (release = resolve))
        return entry.value
      },
      classify,
    )
    await Promise.resolve()
    await Promise.resolve()
    expect(run.running.value).toBe(true)
    release()
    await promise
    expect(progress).toEqual(['1 of 3', '2 of 3', '3 of 3'])
    expect(run.running.value).toBe(false)
  })
})
