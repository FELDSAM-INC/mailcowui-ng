// The quarantine notification settings of one mailbox in a form (UI 006 US3, FR-039, FR-040, legacy
// form map screen 3): the frequency and the category as legacy's option groups, each changeable
// only as the caller's permissions allow. A save sends only the changed members with the version
// tag that was read (`If-Match`). Outcomes:
// - 200: the response becomes the base; legacy's `success.mailbox_modified` is the caller's.
// - 412: the input is kept, the settings are reloaded and the values that changed are listed with
//   their saved values ("Save again" or "Discard my changes"); nothing is merged or retried.
// - 403 `attribute-not-permitted`: the named members turn read-only ("Prohibited by ACL" and the
//   flag) and the identity is reloaded; the other input is kept.
// The mailbox page's "Mailbox" section (UI 003) uses it as a section companion (D9), the interim
// Notifications page and UI 005's later mail settings page through `NotificationSettingsPanel`.
import { useQueryClient } from '@tanstack/vue-query'
import { computed, ref, shallowRef, watch } from 'vue'

import {
  isApiProblem,
  notPermittedAttributesOf,
  problemOf,
  queryKeys,
  type ApiProblem,
  type PermissionFlags,
  type QuarantineNotificationCategory,
  type QuarantineNotificationFrequency,
  type QuarantineNotificationSettings,
  type QuarantineNotificationSettingsPatch,
} from '@/api'
import { lt, text, type LegacyKey } from '@/i18n'
import { useProblemMessages } from '@/i18n/problems'
import type { SectionChange, SectionCompanion } from '@/shared/components/editable-section'
import { changedSince } from '@/shared/composables/useVersionedSave'

import {
  fetchNotificationSettings,
  updateNotificationSettings,
  useNotificationSettings,
} from '../notifications-api'

export type NotificationField = 'frequency' | 'category'

export const NOTIFICATION_FIELDS: readonly NotificationField[] = ['frequency', 'category']

/** The legacy option groups, in legacy order (screen 3). */
export const FREQUENCY_OPTIONS: readonly {
  value: QuarantineNotificationFrequency
  labelKey: LegacyKey
}[] = [
  { value: 'never', labelKey: 'user.never' },
  { value: 'hourly', labelKey: 'user.hourly' },
  { value: 'daily', labelKey: 'user.daily' },
  { value: 'weekly', labelKey: 'user.weekly' },
]

export const CATEGORY_OPTIONS: readonly {
  value: QuarantineNotificationCategory
  labelKey: LegacyKey
}[] = [
  { value: 'rejected', labelKey: 'user.q_reject' },
  { value: 'junk', labelKey: 'user.q_add_header' },
  { value: 'all', labelKey: 'user.q_all' },
]

/** The legacy label, help, permission flag and its `acl.*` label of each member. */
export const NOTIFICATION_FIELD_INFO: Record<
  NotificationField,
  { labelKey: LegacyKey; helpKey: LegacyKey; flag: keyof PermissionFlags; aclKey: LegacyKey }
> = {
  frequency: {
    labelKey: 'user.quarantine_notification',
    helpKey: 'user.quarantine_notification_info',
    flag: 'quarantineNotification',
    aclKey: 'acl.quarantine_notification',
  },
  category: {
    labelKey: 'user.quarantine_category',
    helpKey: 'user.quarantine_category_info',
    flag: 'quarantineCategory',
    aclKey: 'acl.quarantine_category',
  },
}

/** A stored value's label; a mailbox without a stored category has none ("-", D4). */
export function notificationValueLabel(field: NotificationField, value: string | null): string {
  if (value === null) return '-'
  return text(
    `enums.${field === 'frequency' ? 'quarantineNotificationFrequency' : 'quarantineNotificationCategory'}.${value}`,
  )
}

export type NotificationSaveOutcome = 'saved' | 'unchanged' | 'outdated' | 'failed'

export interface NotificationEditorOptions {
  /** The mailbox address. */
  mailbox: () => string
  /** Whether the caller may change a member (`canChangeFrequency`, `canChangeCategory`). */
  canChange: (field: NotificationField) => boolean
  /** Whether the settings are read at all (the field is shown). */
  enabled?: () => boolean
}

export function useNotificationEditor(options: NotificationEditorOptions) {
  const client = useQueryClient()
  const { problemMessage } = useProblemMessages()
  const enabled = () => options.enabled?.() ?? true
  const query = useNotificationSettings(options.mailbox, enabled)

  /** The version the form was opened with (after a 412: the reloaded one). */
  const base = shallowRef<QuarantineNotificationSettings | null>(null)
  const frequency = ref<QuarantineNotificationFrequency | null>(null)
  const category = ref<QuarantineNotificationCategory | null>(null)
  /** Members the API refused with `attribute-not-permitted`; read-only from then on. */
  const refused = ref(new Set<NotificationField>())
  const changes = shallowRef<SectionChange[]>([])
  const problem = shallowRef<ApiProblem | null>(null)
  const pending = ref(false)
  let opened = false
  let touched = false

  const editable = (field: NotificationField) =>
    options.canChange(field) && !refused.value.has(field)
  const anyEditable = computed(() => NOTIFICATION_FIELDS.some((field) => editable(field)))

  function take(settings: QuarantineNotificationSettings | null) {
    base.value = settings
    frequency.value = settings?.frequency ?? null
    category.value = settings?.category ?? null
    touched = false
  }

  // The settings arrive after the form opened: the form takes them unless the user chose already.
  watch(
    () => query.data.value,
    (settings) => {
      if (!opened || !settings) return
      if (!base.value || !touched) take(settings)
    },
  )

  function open() {
    if (!enabled()) return
    opened = true
    changes.value = []
    problem.value = null
    take(query.data.value ?? null)
  }

  function close() {
    opened = false
  }

  function choose(field: NotificationField, value: string) {
    if (!editable(field)) return
    touched = true
    if (field === 'frequency') frequency.value = value as QuarantineNotificationFrequency
    else category.value = value as QuarantineNotificationCategory
  }

  /** The changed members the caller may change. */
  function patch(): QuarantineNotificationSettingsPatch {
    const current = base.value
    const body: QuarantineNotificationSettingsPatch = {}
    if (!current) return body
    if (editable('frequency') && frequency.value && frequency.value !== current.frequency) {
      body.frequency = frequency.value
    }
    if (editable('category') && category.value && category.value !== current.category) {
      body.category = category.value
    }
    return body
  }

  const dirty = () => opened && !!base.value && Object.keys(patch()).length > 0

  const labelOf = (field: NotificationField) => lt(NOTIFICATION_FIELD_INFO[field].labelKey)

  async function reload(): Promise<QuarantineNotificationSettings | null> {
    try {
      const latest = await fetchNotificationSettings(options.mailbox())
      client.setQueryData(queryKeys.quarantine.notificationSettings(options.mailbox()), latest)
      return latest
    } catch {
      return null
    }
  }

  async function save(): Promise<NotificationSaveOutcome> {
    const current = base.value
    const body = patch()
    if (!current || Object.keys(body).length === 0) return 'unchanged'
    pending.value = true
    problem.value = null
    try {
      const saved = await updateNotificationSettings(client, options.mailbox(), body, current.etag)
      take(saved)
      changes.value = []
      return 'saved'
    } catch (error) {
      const failure = problemOf(error)!
      if (isApiProblem(error) && error.status === 412) {
        const latest = await reload()
        if (latest) {
          changes.value = changedSince(current, latest, NOTIFICATION_FIELDS).map(
            ({ field, savedValue }) => ({
              field: `quarantine-${field}`,
              label: labelOf(field),
              saved: notificationValueLabel(field, savedValue as string | null),
            }),
          )
          // The user's input stays; the next save carries the reloaded version.
          base.value = latest
          return 'outdated'
        }
      }
      const refusedMembers = notPermittedAttributesOf(failure)?.attributes ?? []
      if (refusedMembers.length > 0) {
        refused.value = new Set([...refused.value, ...refusedMembers])
        if (base.value) {
          // A refused member keeps its stored value.
          if (refusedMembers.includes('frequency')) frequency.value = base.value.frequency
          if (refusedMembers.includes('category')) category.value = base.value.category
        }
      }
      problem.value = failure
      return 'failed'
    } finally {
      pending.value = false
    }
  }

  /** "Discard my changes" after an outdated save: the form takes the reloaded values. */
  function discard() {
    changes.value = []
    problem.value = null
    take(base.value)
  }

  /** The text of the last refusal, with legacy's flag labels as the attribute names. */
  const failureText = computed(() =>
    problem.value
      ? problemMessage(problem.value, {
          labelFor: (name) =>
            name in NOTIFICATION_FIELD_INFO
              ? lt(NOTIFICATION_FIELD_INFO[name as NotificationField].aclKey)
              : name,
        })
      : null,
  )

  /** The editor as a companion of UI 003's "Mailbox" section (D9). */
  const companion: SectionCompanion = {
    open,
    dirty,
    save,
    outdated: () => changes.value,
    discard,
    failure: () => failureText.value,
  }

  return {
    query,
    base,
    frequency,
    category,
    refused,
    changes,
    problem,
    failureText,
    pending,
    editable,
    anyEditable,
    open,
    close,
    choose,
    dirty,
    save,
    discard,
    companion,
  }
}

export type NotificationEditor = ReturnType<typeof useNotificationEditor>
