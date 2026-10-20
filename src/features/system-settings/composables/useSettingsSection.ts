// UI 013 R9: local drafts over the shared optimistic-concurrency primitive. Ordered lists and
// nested settings compare by value; only an explicit retry adopts a newly read version.
import { useQueryClient, type QueryKey } from '@tanstack/vue-query'
import { computed, onScopeDispose, ref, shallowRef } from 'vue'

import { ApiProblem, problemOf, queryKeys, runMutation } from '@/api'
import { announce } from '@/shared/composables/useAnnouncer'
import { useProblemForm } from '@/shared/composables/useProblemForm'
import { changedSince, useVersionedSave } from '@/shared/composables/useVersionedSave'
import type { SectionStatus } from '@/shared/components/editable-section'

interface SettingsSectionOptions<R extends { etag: string }, D, P> {
  resource: () => R | undefined
  key: QueryKey
  fields: readonly (keyof R)[]
  refetch: () => Promise<R | undefined>
  toDraft: (resource: R) => D
  toPatch: (draft: D, opened: R) => P | null
  send: (patch: P, ifMatch: string) => Promise<R>
  success: () => string
  allowed?: () => boolean
  fieldId?: (path: string) => string | null
  afterSave?: (saved: R) => void | Promise<void>
}

export function useSettingsSection<R extends { etag: string }, D, P>(
  options: SettingsSectionOptions<R, D, P>,
) {
  const client = useQueryClient()
  const editing = ref(false)
  const draft = ref<D | null>(null)
  const base = shallowRef<R>()
  const opened = shallowRef<R>()
  const status = shallowRef<SectionStatus | null>(null)
  const problem = shallowRef<ApiProblem | null>(null)
  const form = useProblemForm({ fieldId: options.fieldId ?? (() => null) })
  const versioned = useVersionedSave({ current: () => base.value, refetch: options.refetch })
  let disposed = false
  onScopeDispose(() => {
    disposed = true
    draft.value = null
  })

  const patch = () =>
    draft.value !== null && opened.value ? options.toPatch(draft.value as D, opened.value) : null
  const dirty = computed(() => editing.value && patch() !== null)
  const changes = computed(() =>
    opened.value && versioned.latest.value
      ? changedSince(
          opened.value,
          versioned.latest.value,
          options.fields,
          Object.fromEntries(options.fields.map((field) => [field, 'value'])) as Partial<
            Record<keyof R, 'value'>
          >,
        )
      : [],
  )

  function open() {
    const resource = options.resource()
    if (!resource || disposed || options.allowed?.() === false || versioned.pending.value) return
    opened.value = resource
    base.value = resource
    draft.value = options.toDraft(resource) as typeof draft.value
    editing.value = true
    status.value = null
    problem.value = null
    form.clear()
    versioned.discard()
  }
  function discard() {
    if (versioned.pending.value) return
    const latest = versioned.discard() ?? options.resource()
    if (latest) draft.value = options.toDraft(latest) as typeof draft.value
    editing.value = false
    problem.value = null
    form.clear()
  }
  async function save() {
    if (disposed || !editing.value || versioned.pending.value || options.allowed?.() === false)
      return
    const body = patch()
    if (body === null) {
      discard()
      return
    }
    problem.value = null
    form.clear()
    try {
      const result = await versioned.save(body, (input, ifMatch) =>
        runMutation(
          client,
          {
            mutationFn: (value: P) => options.send(value, ifMatch),
            retry: false,
          },
          input,
        ),
      )
      if (disposed) return
      if (result.status === 'saved') {
        client.setQueryData(options.key, result.result)
        void client.invalidateQueries({ queryKey: queryKeys.auditEvents.all() })
        opened.value = result.result
        base.value = result.result
        draft.value = options.toDraft(result.result) as typeof draft.value
        editing.value = false
        status.value = { kind: 'success', message: options.success() }
        announce(status.value.message)
        await options.afterSave?.(result.result)
      } else if (result.status === 'failed') {
        problem.value = result.problem
        if (result.problem.is('demo-mode')) {
          void client.invalidateQueries({ queryKey: queryKeys.systemSettings.capabilities() })
        }
        await form.setProblem(result.problem)
      }
    } catch (error) {
      if (!disposed)
        problem.value = problemOf(error) ?? ApiProblem.fromParts({ kind: 'problem', cause: error })
    }
  }
  async function saveAgain() {
    if (versioned.pending.value) return
    if (versioned.latest.value) base.value = versioned.latest.value
    await save()
  }
  return {
    editing,
    draft,
    dirty,
    status,
    problem,
    form,
    changes,
    saving: versioned.pending,
    outdated: versioned.outdated,
    open,
    save,
    saveAgain,
    discard,
  }
}
