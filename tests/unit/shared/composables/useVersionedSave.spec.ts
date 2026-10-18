// Versioned saves (conventions "Editing and conflicts", research R20): If-Match with the read
// version, 412 keeps the input, reloads and exposes the latest value, no automatic retry, never
// `*`, and a refused deletion asks for confirmation again.
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { ApiProblem } from '@/api'
import { changedSince, useVersionedSave } from '@/shared/composables/useVersionedSave'

interface Item {
  name: string
  etag: string
}

const precondition = () =>
  ApiProblem.fromParts({
    kind: 'problem',
    type: 'about:blank',
    status: 412,
    requestId: 'r'.repeat(32),
  })

function setup(initial: Item | null = { name: 'old', etag: '"1"' }) {
  const current = ref<Item | null>(initial)
  const latest: Item = { name: 'changed elsewhere', etag: '"2"' }
  const refetch = vi.fn(() => {
    current.value = latest
    return Promise.resolve(latest)
  })
  return { current, latest, refetch }
}

describe('useVersionedSave', () => {
  it('sends If-Match with the version that was read', async () => {
    const { current, refetch } = setup()
    const send = vi.fn((_input: { name: string }, ifMatch: string) =>
      Promise.resolve({ name: 'new', etag: ifMatch === '"1"' ? '"3"' : 'x' }),
    )
    const save = useVersionedSave({ current: () => current.value, refetch })
    const result = await save.save({ name: 'new' }, send)
    expect(send).toHaveBeenCalledWith({ name: 'new' }, '"1"')
    expect(result).toEqual({ status: 'saved', result: { name: 'new', etag: '"3"' } })
    expect(save.outdated.value).toBe(false)
  })

  it('on 412 keeps the input, reloads, marks outdated and exposes the latest value', async () => {
    const { current, refetch, latest } = setup()
    const input = { name: 'my edit' }
    const send = vi.fn(() => Promise.reject(precondition()))
    const save = useVersionedSave({ current: () => current.value, refetch })
    const result = await save.save(input, send)
    expect(result).toEqual({ status: 'outdated', latest })
    expect(input).toEqual({ name: 'my edit' })
    expect(refetch).toHaveBeenCalledTimes(1)
    expect(save.outdated.value).toBe(true)
    expect(save.latest.value).toEqual(latest)
    // No automatic retry.
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('saves again with the reloaded version when the user retries', async () => {
    const { current, refetch } = setup()
    const send = vi
      .fn<(input: { name: string }, ifMatch: string) => Promise<Item>>()
      .mockRejectedValueOnce(precondition())
      .mockResolvedValueOnce({ name: 'mine', etag: '"4"' })
    const save = useVersionedSave({ current: () => current.value, refetch })
    await save.save({ name: 'mine' }, send)
    const second = await save.save({ name: 'mine' }, send)
    expect(send.mock.calls.map((call) => call[1])).toEqual(['"1"', '"2"'])
    expect(second.status).toBe('saved')
    expect(save.outdated.value).toBe(false)
  })

  it('never sends * and refuses to save without a version', async () => {
    const { refetch } = setup(null)
    const send = vi.fn(() => Promise.resolve({}))
    const save = useVersionedSave<Item>({ current: () => null, refetch })
    const result = await save.save({}, send)
    expect(result.status).toBe('failed')
    expect(send).not.toHaveBeenCalled()
  })

  it('reports other failures without reloading', async () => {
    const { current, refetch } = setup()
    const problem = ApiProblem.fromParts({ kind: 'network' })
    const save = useVersionedSave({ current: () => current.value, refetch })
    const result = await save.save({}, () => Promise.reject(problem))
    expect(result).toEqual({ status: 'failed', problem })
    expect(save.problem.value).toBe(problem)
    expect(refetch).not.toHaveBeenCalled()
  })

  it('asks for confirmation again when a deletion is refused as outdated', async () => {
    const { current, refetch, latest } = setup()
    const send = vi
      .fn<(ifMatch: string) => Promise<void>>()
      .mockRejectedValueOnce(precondition())
      .mockResolvedValueOnce(undefined)
    const confirmAgain = vi.fn(() => Promise.resolve(true))
    const save = useVersionedSave({ current: () => current.value, refetch })
    const result = await save.remove(send, confirmAgain)
    expect(confirmAgain).toHaveBeenCalledWith(latest)
    expect(send.mock.calls.map((call) => call[0])).toEqual(['"1"', '"2"'])
    expect(result.status).toBe('saved')
  })

  it('stops when the repeated confirmation is declined', async () => {
    const { current, refetch } = setup()
    const send = vi.fn(() => Promise.reject(precondition()))
    const save = useVersionedSave({ current: () => current.value, refetch })
    const result = await save.remove(send, () => Promise.resolve(false))
    expect(result.status).toBe('cancelled')
    expect(send).toHaveBeenCalledTimes(1)
  })
})

// UI 002 (T016, research D11): the field diff after an outdated save.
describe('changedSince', () => {
  interface Values {
    description: string
    tags: string[]
    domainQuota: number
    rateLimit: { value: number; frame: string } | null
    active: boolean
  }
  const base: Values = {
    description: 'Old',
    tags: ['a', 'B'],
    domainQuota: 10_737_418_240,
    rateLimit: null,
    active: true,
  }

  it('returns the fields whose saved value changed, with the new saved values', () => {
    const latest: Values = { ...base, description: 'New', domainQuota: 21_474_836_480 }
    expect(changedSince(base, latest, ['description', 'tags', 'domainQuota', 'active'])).toEqual([
      { field: 'description', savedValue: 'New' },
      { field: 'domainQuota', savedValue: 21_474_836_480 },
    ])
  })

  it('compares tags as sets ignoring letter case and order, objects by value', () => {
    expect(changedSince(base, { ...base, tags: ['b', 'A'] }, ['tags'])).toEqual([])
    expect(changedSince(base, { ...base, tags: ['a', 'c'] }, ['tags'])).toEqual([
      { field: 'tags', savedValue: ['a', 'c'] },
    ])
    expect(
      changedSince(base, { ...base, rateLimit: { value: 5, frame: 'hour' } }, ['rateLimit']),
    ).toHaveLength(1)
  })

  it('lets "Discard" take the latest values and clears the outdated state', async () => {
    const { current, refetch, latest } = setup()
    const save = useVersionedSave({ current: () => current.value, refetch })
    await save.save({ name: 'mine' }, () => Promise.reject(precondition()))
    expect(save.outdated.value).toBe(true)
    expect(save.discard()).toEqual(latest)
    expect(save.outdated.value).toBe(false)
    expect(save.latest.value).toBeUndefined()
  })
})
