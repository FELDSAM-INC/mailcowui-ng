// Saving the footer section of the domain page (UI 002 US7, FR-057 to FR-062): the form opened with
// the footer it was read from; a save replaces the footer with `If-Match`. A 412 keeps the input,
// reloads the footer and lists what changed in the meantime ("Save again" sends the reloaded footer
// with the user's changes, "Discard" takes the reloaded values); a 422 shows field errors, the
// exclusions by position; a gone domain and other failures are explained with nothing saved.
// Saving says legacy's `success.domain_footer_modified`.
import { useQueryClient } from '@tanstack/vue-query'
import { computed, ref, shallowRef, watch, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { lt, type LegacyKey } from '@/i18n'
import type { ApiProblem, DomainFooter } from '@/api'
import type { SectionStatus } from '@/shared/components/editable-section'
import { announce } from '@/shared/composables/useAnnouncer'
import { useProblemForm } from '@/shared/composables/useProblemForm'
import { changedSince, useVersionedSave } from '@/shared/composables/useVersionedSave'

import { footerOptions, problemOf, replaceFooter } from '../api'
import {
  FOOTER_FIELDS,
  footerForm,
  mergeFooterChanges,
  toFooterReplace,
  validateFooter,
  type FooterForm,
} from '../footer'
import { useDomainFormat } from '../format'
import { useClientErrors } from '@/shared/composables/useClientErrors'

const LABELS: Record<string, LegacyKey> = {
  excludedAddresses: 'edit.footer_exclude',
  excludedAliasDomains: 'edit.footer_exclude',
  skipReplies: 'edit.domain_footer_skip_replies',
  html: 'edit.domain_footer_html',
  plain: 'edit.domain_footer_plain',
}

export function useFooterSection(options: {
  domain: () => string
  footer: () => DomainFooter | undefined
  editing: () => boolean
  maxBytes: () => number
  onSaved: () => void
}) {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const format = useDomainFormat()
  const translate = useClientErrors()

  const base = shallowRef<DomainFooter | null>(null)
  const opened = shallowRef<DomainFooter | null>(null)
  const form = ref<FooterForm | null>(null) as Ref<FooterForm | null>
  const status = ref<SectionStatus | null>(null)
  const problem = shallowRef<ApiProblem | null>(null)
  const pending = ref(false)
  const outdatedFields = shallowRef<{ field: string; savedValue: unknown }[] | null>(null)

  const problemForm = useProblemForm({
    fieldId: (path) => {
      const field = path.split('.')[0] ?? path
      if (field === 'excludedAddresses' || field === 'excludedAliasDomains') {
        return 'section-footer-exclude'
      }
      return (FOOTER_FIELDS as readonly string[]).includes(field) ? `section-footer-${field}` : null
    },
    fieldKind: () => undefined,
    labelFor: (field) => (LABELS[field] ? lt(LABELS[field]) : field),
  })

  const versioned = useVersionedSave<DomainFooter>({
    current: () => base.value,
    refetch: () => queryClient.fetchQuery({ ...footerOptions(options.domain()), staleTime: 0 }),
  })

  function open(footer: DomainFooter) {
    base.value = footer
    opened.value = footer
    form.value = footerForm(footer)
    outdatedFields.value = null
    problem.value = null
    problemForm.clear()
    versioned.discard()
  }

  watch(
    [options.editing, options.footer],
    ([on, footer]) => {
      if (on && footer && !form.value) open(footer)
      if (!on) form.value = null
    },
    { immediate: true },
  )

  const dirty = computed(
    () =>
      !!form.value &&
      !!opened.value &&
      JSON.stringify(form.value) !== JSON.stringify(footerForm(opened.value)),
  )

  function setStatus(next: SectionStatus | null) {
    status.value = next
    if (next) announce(next.message)
  }

  async function send(body: FooterForm) {
    const from = base.value
    if (!from || pending.value) return
    pending.value = true
    problem.value = null
    problemForm.clear()
    try {
      const result = await versioned.save(toFooterReplace(body), (request, ifMatch) =>
        replaceFooter(queryClient, options.domain(), request, ifMatch),
      )
      if (result.status === 'saved') {
        open(result.result)
        setStatus({
          kind: 'success',
          message: lt('success.domain_footer_modified', options.domain()),
        })
        options.onSaved()
        return
      }
      if (result.status === 'outdated') {
        outdatedFields.value = changedSince(from, result.latest ?? from, FOOTER_FIELDS)
        return
      }
      if (result.status === 'cancelled') return
      const failure = problemOf(result.problem)!
      if (failure.status === 422) {
        await problemForm.setProblem(failure)
        return
      }
      problem.value = failure
    } finally {
      pending.value = false
    }
  }

  async function save() {
    if (!form.value) return
    const errors = validateFooter(form.value, options.maxBytes(), format)
    if (Object.keys(errors).length > 0) {
      await problemForm.setClientMessages(translate(errors))
      return
    }
    await send(form.value)
  }

  /** "Save again" after a 412: the reloaded footer with the user's changes. */
  async function saveAgain() {
    const latest = versioned.latest.value
    if (!form.value || !opened.value) return
    if (latest) base.value = latest
    outdatedFields.value = null
    await send(latest ? mergeFooterChanges(opened.value, latest, form.value) : form.value)
  }

  function discard() {
    const latest = versioned.discard() ?? base.value
    if (latest) open(latest)
  }

  const display = (field: string, value: unknown) => {
    if (typeof value === 'boolean') return format.yesNo(value)
    if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : t('domains.values.none')
    return String(value)
  }

  return {
    form,
    status,
    problem,
    pending,
    dirty,
    problemForm,
    outdated: computed(
      () =>
        outdatedFields.value?.map((item) => ({
          field: item.field,
          label: LABELS[item.field] ? lt(LABELS[item.field]!) : item.field,
          saved: display(item.field, item.savedValue),
        })) ?? null,
    ),
    errorsFor: (path: string) => problemForm.errorsFor(path),
    save,
    saveAgain,
    discard,
  }
}
