// An entry's edit page (UI 009 T012, research R6): changed members only with `If-Match`, the
// outdated save with "Save again" and "Discard my changes", field errors from the form-context
// lookup, conflicts on their field, and the typed password cleared after every attempt.
import { describe, expect, it, vi } from 'vitest'
import { shallowRef } from 'vue'

import { ApiProblem } from '@/api'
import { useEntryForm } from '@/features/routing/composables/useEntryForm'
import { changedMembers } from '@/features/routing/logic/changed-fields'

import { withSetup } from '../../../support/composable'

interface Entry {
  id: number
  host: string
  active: boolean
  etag: string
}
interface Form {
  host: string
  active: boolean
  password: string
}

function setup(send: (patch: Record<string, unknown>, ifMatch: string) => Promise<Entry>) {
  const entry = shallowRef<Entry>({ id: 1, host: 'a.example', active: true, etag: '"v1"' })
  const latest: Entry = { id: 1, host: 'b.example', active: true, etag: '"v2"' }
  const saved = vi.fn()
  const { result } = withSetup(() =>
    useEntryForm<Entry, Form>({
      entry: () => entry.value,
      refetch: () => Promise.resolve(latest),
      toForm: (item) => ({ host: item.host, active: item.active, password: '' }),
      makePatch: (opened, form) => ({
        ...changedMembers(opened, { host: form.host, active: form.active }, ['host', 'active']),
        ...(form.password ? { password: form.password } : {}),
      }),
      send,
      outdatedFields: ['host', 'active'],
      fieldLabel: (field) => `label:${field}`,
      fieldId: (path) => (['host', 'active', 'password'].includes(path) ? `f-${path}` : null),
      formKey: 'routing.relayhosts.form',
      valueAt: () => 'not valid',
      conflict: (problem) => (problem.status === 409 ? { host: ['taken'] } : null),
      onSaved: saved,
      afterAttempt: (form) => {
        form.password = ''
      },
    }),
  )
  return { result, entry, saved }
}

describe('useEntryForm', () => {
  it('sends only the changed members with the version tag and clears the password', async () => {
    const send = vi.fn((patch: Record<string, unknown>) =>
      Promise.resolve({
        id: 1,
        host: typeof patch.host === 'string' ? patch.host : 'a.example',
        active: true,
        etag: '"v3"',
      }),
    )
    const { result, saved } = setup(send)
    expect(await result.save()).toBe('unchanged')
    result.values.value!.host = ' c.example '
    result.values.value!.password = 'Secret-1'
    expect(result.dirty.value).toBe(true)
    expect(await result.save()).toBe('saved')
    expect(send).toHaveBeenCalledWith({ host: 'c.example', password: 'Secret-1' }, '"v1"')
    expect(saved).toHaveBeenCalled()
    expect(result.values.value!.password).toBe('')
    expect(result.dirty.value).toBe(false)
  })

  it('keeps the input after a 412, lists the changes, saves again or discards', async () => {
    let calls = 0
    const send = vi.fn((_patch: Record<string, unknown>, ifMatch: string) => {
      calls += 1
      if (calls === 1) return Promise.reject(ApiProblem.fromParts({ kind: 'problem', status: 412 }))
      return Promise.resolve({ id: 1, host: 'c.example', active: false, etag: ifMatch })
    })
    const { result } = setup(send)
    result.values.value!.active = false
    await result.save()
    expect(result.outdated.value).toEqual([
      { field: 'host', label: 'label:host', saved: 'b.example' },
    ])
    expect(result.values.value!.active).toBe(false)
    await result.saveAgain()
    expect(send).toHaveBeenLastCalledWith({ active: false }, '"v2"')
    result.values.value!.active = true
    send.mockRejectedValueOnce(ApiProblem.fromParts({ kind: 'problem', status: 412 }))
    await result.save()
    result.discard()
    expect(result.values.value!.host).toBe('b.example')
  })

  it('shows conflicts and field errors on their fields and keeps a 404 for "not found"', async () => {
    const send = vi.fn()
    const { result } = setup(send)
    result.values.value!.host = 'x.example'
    send.mockRejectedValueOnce(ApiProblem.fromParts({ kind: 'problem', status: 409 }))
    await result.save()
    expect(result.form.errorsFor('host')).toEqual(['taken'])
    send.mockRejectedValueOnce(
      ApiProblem.fromParts({
        kind: 'problem',
        status: 422,
        type: '/api/v2/problems/validation-failed',
        fieldErrors: new Map([
          ['host', [{ code: 'invalidFormat', message: 'x', params: { format: 'nextHop' } }]],
        ]),
      }),
    )
    await result.save()
    expect(result.form.errorsFor('host')).toEqual(['Invalid host specified: not valid'])
    send.mockRejectedValueOnce(ApiProblem.fromParts({ kind: 'problem', status: 404 }))
    await result.save()
    expect(result.problem.value?.status).toBe(404)
  })
})
