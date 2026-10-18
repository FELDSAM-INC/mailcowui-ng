// Saves with optimistic concurrency (conventions "Editing and conflicts", research R20). A save
// sends `If-Match` with the version tag that was read. A 412 keeps the user's input (the caller
// owns it), reloads the resource, sets `outdated` and exposes the latest value; the user decides
// to save again. Nothing is retried automatically and `*` is never sent. A refused deletion asks
// for confirmation again with the reloaded value.
import { ref, shallowRef } from 'vue'

import { ApiProblem, isApiProblem } from '@/api'

export type VersionedResult<R, T> =
  | { status: 'saved'; result: R }
  | { status: 'outdated'; latest: T | undefined }
  | { status: 'cancelled' }
  | { status: 'failed'; problem: ApiProblem }

export interface VersionedSaveOptions<T extends { etag: string }> {
  /** The resource as last read, with its version tag. */
  current: () => T | null | undefined
  /** Reloads the resource after a 412 and returns the latest value. */
  refetch: () => Promise<T | undefined>
}

const isPreconditionFailed = (error: unknown) => isApiProblem(error) && error.status === 412

function asProblem(error: unknown): ApiProblem {
  return isApiProblem(error) ? error : ApiProblem.fromParts({ kind: 'problem', cause: error })
}

export function useVersionedSave<T extends { etag: string }>(options: VersionedSaveOptions<T>) {
  const outdated = ref(false)
  const latest = shallowRef<T | undefined>(undefined)
  const pending = ref(false)
  const problem = shallowRef<ApiProblem | null>(null)

  function versionTag(): string | null {
    const etag = options.current()?.etag
    return etag && etag !== '*' ? etag : null
  }

  async function reload(): Promise<T | undefined> {
    const value = await options.refetch()
    latest.value = value
    outdated.value = true
    return value
  }

  async function attempt<R>(send: (ifMatch: string) => Promise<R>): Promise<VersionedResult<R, T>> {
    const etag = versionTag()
    if (!etag) {
      const missing = ApiProblem.fromParts({ kind: 'problem', status: 428 })
      problem.value = missing
      return { status: 'failed', problem: missing }
    }
    try {
      const result = await send(etag)
      outdated.value = false
      latest.value = undefined
      return { status: 'saved', result }
    } catch (error) {
      if (isPreconditionFailed(error)) return { status: 'outdated', latest: await reload() }
      problem.value = asProblem(error)
      return { status: 'failed', problem: problem.value }
    }
  }

  async function save<I, R>(
    input: I,
    send: (input: I, ifMatch: string) => Promise<R>,
  ): Promise<VersionedResult<R, T>> {
    pending.value = true
    problem.value = null
    try {
      return await attempt((etag) => send(input, etag))
    } finally {
      pending.value = false
    }
  }

  /** Deletes with If-Match; after a 412 the user confirms again against the reloaded value. */
  async function remove<R>(
    send: (ifMatch: string) => Promise<R>,
    confirmAgain: (latest: T | undefined) => Promise<boolean>,
  ): Promise<VersionedResult<R, T>> {
    pending.value = true
    problem.value = null
    try {
      for (;;) {
        const result = await attempt(send)
        if (result.status !== 'outdated') return result
        if (!(await confirmAgain(result.latest))) return { status: 'cancelled' }
      }
    } finally {
      pending.value = false
    }
  }

  return { outdated, latest, pending, problem, save, remove }
}
