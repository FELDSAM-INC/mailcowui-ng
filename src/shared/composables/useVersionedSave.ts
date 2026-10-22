// Saves with optimistic concurrency (conventions "Editing and conflicts", research R20). A save
// sends `If-Match` with the version tag that was read. A 412 keeps the user's input (the caller
// owns it), reloads the resource, sets `outdated` and exposes the latest value; the user decides
// to save again. Nothing is retried automatically and `*` is never sent. A refused deletion asks
// for confirmation again with the reloaded value. UI 002 adds the field diff of section editing:
// `changedSince` lists the fields that changed in the meantime with their new saved values, and
// `discard` takes the reloaded values (research D11).
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

/** How a field's saved values are compared: `set` (string sets ignoring case), `number` or `value`. */
export type FieldComparison = 'set' | 'number' | 'value'

function comparisonFor(a: unknown, b: unknown): FieldComparison {
  if (Array.isArray(a) && Array.isArray(b)) return 'set'
  if (typeof a === 'number' && typeof b === 'number') return 'number'
  return 'value'
}

/** Whether two saved values of a field are equal under its comparison. */
export function sameFieldValue(a: unknown, b: unknown, comparison?: FieldComparison): boolean {
  switch (comparison ?? comparisonFor(a, b)) {
    case 'set': {
      const left = new Set((a as unknown[]).map((item) => String(item).trim().toLowerCase()))
      const right = new Set((b as unknown[]).map((item) => String(item).trim().toLowerCase()))
      return left.size === right.size && [...left].every((item) => right.has(item))
    }
    case 'number':
      return Number(a) === Number(b)
    case 'value':
      return a === b || JSON.stringify(a) === JSON.stringify(b)
  }
}

/**
 * The fields whose saved value changed between the version a form was opened with (`base`) and
 * the reloaded one (`latest`), with their new saved values. Tags compare as sets ignoring letter
 * case, numbers (quotas in bytes) as numbers, everything else by value.
 */
export function changedSince<T extends object, K extends keyof T>(
  base: T,
  latest: T,
  fields: readonly K[],
  comparisons: Partial<Record<K, FieldComparison>> = {},
): { field: K; savedValue: T[K] }[] {
  return fields
    .filter((field) => !sameFieldValue(base[field], latest[field], comparisons[field]))
    .map((field) => ({ field, savedValue: latest[field] }))
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
      if (isApiProblem(error) && error.kind === 'identityChanged') return { status: 'cancelled' }
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

  /** "Discard my changes": returns the reloaded value and leaves the outdated state. */
  function discard(): T | undefined {
    const value = latest.value
    outdated.value = false
    latest.value = undefined
    return value
  }

  return { outdated, latest, pending, problem, save, remove, discard }
}
