import { useQueryClient } from '@tanstack/vue-query'
import { computed, onScopeDispose, shallowRef, watch } from 'vue'
import {
  problemOf,
  queryKeys,
  type ApiProblem,
  type MailboxMailSettings,
  type MailboxMailSettingsPatch,
} from '@/api'
import { lt, text } from '@/i18n'
import { useProblemMessages } from '@/i18n/problems'
import type { SectionChange, SectionCompanion } from '@/shared/components/editable-section'
import { changedSince } from '@/shared/composables/useVersionedSave'
import { fetchMailSettings, updateMailSettings, useMailSettings } from '../api/mail-settings'

const fields = ['taggedMailHandling', 'tlsEnforceInbound', 'tlsEnforceOutbound'] as const
type Field = (typeof fields)[number]
const labels = {
  taggedMailHandling: 'user.tag_handling',
  tlsEnforceInbound: 'user.tls_enforce_in',
  tlsEnforceOutbound: 'user.tls_enforce_out',
} as const
const valueLabel = (field: Field, value: string | boolean) =>
  field === 'taggedMailHandling'
    ? lt(
        value === 'subject'
          ? 'user.tag_in_subject'
          : value === 'subfolder'
            ? 'user.tag_in_subfolder'
            : 'user.tag_in_none',
      )
    : text(value ? 'domains.values.yes' : 'domains.values.no')

/** The mailbox tab keeps its single Save action; this companion owns the settings' own ETag. */
export function useMailSettingsEditor(options: {
  mailbox: () => string
  canChange: () => boolean
}) {
  const client = useQueryClient()
  const { problemMessage } = useProblemMessages()
  const query = useMailSettings(options.mailbox)
  const base = shallowRef<MailboxMailSettings | null>(null)
  const values = shallowRef<MailboxMailSettings | null>(null)
  const changes = shallowRef<SectionChange[]>([])
  const problem = shallowRef<ApiProblem | null>(null)
  let opened = false
  let touched = false
  let generation = 0
  let disposed = false
  onScopeDispose(() => {
    disposed = true
    generation++
  })
  const take = (value: MailboxMailSettings | null) => {
    base.value = value
    values.value = value ? { ...value } : null
    touched = false
  }
  watch(options.mailbox, () => {
    generation++
    opened = false
    take(null)
  })
  watch(query.data, (value) => {
    if (opened && value && (!base.value || !touched)) take(value)
  })
  function open() {
    opened = true
    problem.value = null
    changes.value = []
    take(query.data.value ?? null)
  }
  function close() {
    opened = false
  }
  function choose<K extends Field>(field: K, value: MailboxMailSettings[K]) {
    if (!opened || !options.canChange() || !values.value) return
    touched = true
    values.value = { ...values.value, [field]: value }
  }
  function patch(): MailboxMailSettingsPatch {
    if (!opened || !options.canChange() || !base.value || !values.value) return {}
    return Object.fromEntries(
      fields
        .filter((key) => values.value![key] !== base.value![key])
        .map((key) => [key, values.value![key]]),
    )
  }
  async function save(): Promise<'saved' | 'unchanged' | 'outdated' | 'failed'> {
    const current = base.value
    const body = patch()
    if (!current || !Object.keys(body).length || disposed) return 'unchanged'
    const owner = options.mailbox()
    const attempt = generation
    const active = () => !disposed && generation === attempt && options.mailbox() === owner
    problem.value = null
    try {
      const saved = await updateMailSettings(client, owner, body, current.etag)
      if (!active()) return 'unchanged'
      take(saved)
      changes.value = []
      return 'saved'
    } catch (error) {
      if (!active()) return 'unchanged'
      const failure = problemOf(error)!
      if (failure.status === 412) {
        try {
          const latest = await fetchMailSettings(owner)
          if (!active()) return 'unchanged'
          // Do not let the cache watch replace a user's draft during the conflict reload.
          client.setQueryData(queryKeys.selfService.mailSettings(owner), latest)
          changes.value = changedSince(current, latest, fields).map(({ field, savedValue }) => ({
            field,
            label: lt(labels[field]),
            saved: valueLabel(field, savedValue),
          }))
          base.value = latest
          return 'outdated'
        } catch (reloadError) {
          if (active()) problem.value = problemOf(reloadError)
          return active() ? 'failed' : 'unchanged'
        }
      }
      problem.value = failure
      return 'failed'
    }
  }
  const failure = computed(() => (problem.value ? problemMessage(problem.value) : null))
  const companion: SectionCompanion = {
    open,
    dirty: () => Object.keys(patch()).length > 0,
    save,
    outdated: () => changes.value,
    discard: () => {
      take(base.value)
      changes.value = []
      problem.value = null
    },
    failure: () => failure.value,
  }
  return { query, values, choose, close, companion }
}
