// Saving one section of the domain page (UI 002 research D11, data-model §7 "Section edit"). The
// section's form is opened with the domain it was read from (`base`); a save sends the changed
// members with `If-Match` set to that version.
// - 200: the new version becomes the base (FR-036).
// - 412: the input is kept, the domain is reloaded and the section's fields that changed in the
//   meantime are listed with their new saved values; "Save again" uses the reloaded version and
//   "Discard" takes its values (FR-037). Nothing is merged or sent on its own.
// - 422: field errors on their fields, sizes formatted as sizes (FR-065).
// - 403 attribute-not-permitted: the refused attributes turn read-only, the identity and the domain
//   are reloaded, the other input is kept (FR-003).
// - 404: the domain is gone; 500 and network: nothing was saved, retry keeps the input.
import { useQueryClient } from '@tanstack/vue-query'
import { ref, shallowRef } from 'vue'
import { text } from '@/i18n'
import { queryKeys, type ApiProblem, type Domain, type DomainPatch } from '@/api'
import { useProblemForm } from '@/shared/composables/useProblemForm'
import { changedSince, useVersionedSave } from '@/shared/composables/useVersionedSave'

import { domainOptions, problemOf, updateDomain } from '../api'
import { FIELD_LABEL_KEYS, SIZE_FIELDS } from '../field-labels'
import type { EditableAttribute } from '../permissions'

export type SectionSaveOutcome =
  'saved' | 'unchanged' | 'outdated' | 'invalid' | 'refused' | 'gone' | 'failed'

export interface SectionSaveOptions {
  /** The latest domain the page shows. */
  domain: () => Domain
  /** The attributes of the section. */
  fields: readonly EditableAttribute[]
  /** The element ID of a field's control, for focusing field errors. */
  fieldId?: (path: string) => string | null
}

export function useDomainSectionSave(options: SectionSaveOptions) {
  const queryClient = useQueryClient()
  const base = shallowRef<Domain | null>(null)
  const outdatedFields = shallowRef<{ field: EditableAttribute; savedValue: unknown }[] | null>(
    null,
  )
  const refused = ref(new Set<string>())
  const problem = shallowRef<ApiProblem | null>(null)
  const pending = ref(false)

  const form = useProblemForm({
    fieldId: (path) =>
      options.fields.includes(path.split('.')[0] as EditableAttribute)
        ? (options.fieldId?.(path) ?? path)
        : null,
    fieldKind: (path) => (SIZE_FIELDS.has(path) ? 'size' : undefined),
    labelFor: (field) => (FIELD_LABEL_KEYS[field] ? text(FIELD_LABEL_KEYS[field]) : field),
  })

  const name = () => base.value?.name ?? options.domain().name

  const versioned = useVersionedSave<Domain>({
    current: () => base.value,
    refetch: () => queryClient.fetchQuery({ ...domainOptions(queryClient, name()), staleTime: 0 }),
  })

  function open() {
    base.value = options.domain()
    outdatedFields.value = null
    refused.value = new Set()
    problem.value = null
    form.clear()
    versioned.discard()
  }

  async function save(makePatch: (base: Domain) => DomainPatch): Promise<SectionSaveOutcome> {
    if (!base.value || pending.value) return 'unchanged'
    const patch = makePatch(base.value)
    for (const attribute of refused.value) delete (patch as Record<string, unknown>)[attribute]
    if (Object.keys(patch).length === 0) return 'unchanged'
    pending.value = true
    problem.value = null
    form.clear()
    try {
      const result = await versioned.save(patch, (body, ifMatch) =>
        updateDomain(queryClient, name(), body, ifMatch),
      )
      if (result.status === 'saved') {
        base.value = result.result
        outdatedFields.value = null
        return 'saved'
      }
      if (result.status === 'outdated') {
        const latest = result.latest ?? base.value
        outdatedFields.value = changedSince(base.value, latest, options.fields)
        return 'outdated'
      }
      if (result.status === 'cancelled') return 'unchanged'
      const failure = problemOf(result.problem)!
      if (failure.is('validation-failed') || failure.status === 422) {
        await form.setProblem(failure)
        return 'invalid'
      }
      problem.value = failure
      if (failure.is('attribute-not-permitted')) {
        const attributes = failure.extensions.attributes
        if (Array.isArray(attributes)) {
          refused.value = new Set([...refused.value, ...attributes.map(String)])
        }
        void queryClient.invalidateQueries({ queryKey: queryKeys.domains.detail(name()) })
        return 'refused'
      }
      if (failure.status === 404) return 'gone'
      return 'failed'
    } finally {
      pending.value = false
    }
  }

  /** "Save again" after a 412: the reloaded version becomes the base. */
  function saveAgain(makePatch: (base: Domain) => DomainPatch): Promise<SectionSaveOutcome> {
    const latest = versioned.latest.value
    if (latest) base.value = latest
    outdatedFields.value = null
    return save(makePatch)
  }

  /** "Discard my changes" after a 412: returns the reloaded version, which becomes the base. */
  function discard(): Domain | null {
    const latest = versioned.discard() ?? base.value
    base.value = latest
    outdatedFields.value = null
    return latest
  }

  return { base, outdatedFields, refused, problem, pending, form, open, save, saveAgain, discard }
}
