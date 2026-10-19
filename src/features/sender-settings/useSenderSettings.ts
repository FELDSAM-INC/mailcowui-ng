// "Allow to send as" and "External sender addresses" inside UI 003's "Mailbox" section, at their
// legacy positions (`templates/edit/mailbox.twig` #medit; orchestrator, 2026-10-19). The API keeps
// them as a resource of their own (`/mailboxes/{mailbox}/sender-settings`, with its own version
// tag), so this composable owns their read, working copy, save, conflicts and errors, and
// `combine()` joins them to the section's save:
// - the sender settings are saved first, each changed set whole with `If-Match` (FR-054); a refusal
//   keeps the section open with every entry as entered and marked (FR-054, US5-AS7);
// - then the mailbox's own changes, as before;
// - a 412 keeps the working copy, reloads and lists the changed sets with their saved values;
// - legacy's `success.mailbox_modified` is the outcome, as the classic page saves both together;
// - entries the server dropped because an alias already allows them are named (FR-055).
// External sender addresses are hidden without `extendSenderAcl` (legacy's `data-acl`) and never
// sent then; `*` is offered to administrators only.
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, ref, shallowRef, toValue, watch, type MaybeRefOrGetter, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  type ApiProblem,
  type Identity,
  type MailboxSenderSettings,
  type MailboxSenderSettingsPatch,
} from '@/api'
import { feature004Permissions } from '@/features/aliases-common'
import { lt, text } from '@/i18n'
import { useFormat } from '@/i18n/format'
import type { SectionChange, SectionStatus } from '@/shared/components/editable-section'
import { announce } from '@/shared/composables/useAnnouncer'
import { useProblemForm } from '@/shared/composables/useProblemForm'
import { useVersionedSave } from '@/shared/composables/useVersionedSave'
import { parseEntryList } from '@/shared/validation/entry-list'

import { fetchSenderSettings, senderSettingsOptions, updateSenderSettings } from './api'
import { entryLabel } from './labels'
import {
  buildSenderPatch,
  entryForPath,
  notNeededAfterSave,
  selectedEntries,
  toWorkingCopy,
  type SenderEntry,
  type SenderWorkingCopy,
} from './send-as-model'

export const SENDER_ACL_ID = 'section-mailbox-senderAcl'
export const EXTERNAL_SENDERS_ID = 'section-mailbox-externalSenderAddresses'

export type SenderSaveOutcome = 'unchanged' | 'saved' | 'outdated' | 'failed'

export interface SenderSettingsOptions {
  mailbox: MaybeRefOrGetter<string>
  editing: MaybeRefOrGetter<boolean>
  identity: MaybeRefOrGetter<Identity | null | undefined>
}

export function useSenderSettings(options: SenderSettingsOptions) {
  const { t } = useI18n()
  const fmt = useFormat()
  const queryClient = useQueryClient()
  const mailbox = computed(() => toValue(options.mailbox))
  const query = useQuery(computed(() => senderSettingsOptions(mailbox.value)))
  const permissions = computed(() => feature004Permissions(toValue(options.identity), null))

  const base = shallowRef<MailboxSenderSettings | null>(null)
  const copy = ref<SenderWorkingCopy | null>(null) as Ref<SenderWorkingCopy | null>
  const sent = shallowRef<MailboxSenderSettingsPatch>({})
  const status = ref<SectionStatus | null>(null)
  const outdated = shallowRef<SectionChange[] | null>(null)
  const notNeeded = ref<string[]>([])

  const versioned = useVersionedSave<MailboxSenderSettings>({
    current: () => base.value,
    refetch: async () => {
      const latest = await fetchSenderSettings(mailbox.value)
      queryClient.setQueryData(senderSettingsOptions(mailbox.value).queryKey, latest)
      return latest
    },
  })

  const problems = useProblemForm({
    formKey: 'senderSettings',
    fieldId: (path) => {
      const field = path.split('.')[0]
      if (field === 'explicitPermissions') return SENDER_ACL_ID
      if (field === 'externalSenderAddresses') return EXTERNAL_SENDERS_ID
      return null
    },
    valueAt: (path) => entryForPath(path, sent.value),
  })

  function open(settings: MailboxSenderSettings) {
    base.value = settings
    copy.value = toWorkingCopy(settings)
    outdated.value = null
    notNeeded.value = []
    problems.clear()
    versioned.discard()
  }

  // The section opens: the form starts from the settings as read now.
  watch(
    [() => toValue(options.editing), () => query.data.value] as const,
    ([editing, settings], previous) => {
      if (!editing) {
        copy.value = null
        return
      }
      if (settings && (!previous?.[0] || !copy.value)) open(settings)
    },
    { immediate: true },
  )

  const patch = computed(() => {
    if (!base.value || !copy.value) return null
    const next = buildSenderPatch(base.value, copy.value)
    if (next && !permissions.value.canEditExternalSenderAddresses) {
      delete next.externalSenderAddresses
    }
    return next && Object.keys(next).length > 0 ? next : null
  })
  const dirty = computed(() => patch.value !== null)

  function add(entry: SenderEntry) {
    if (!copy.value) return
    const key = entry.value.toLowerCase()
    if (copy.value.explicit.some((item) => item.value.toLowerCase() === key)) return
    copy.value = { ...copy.value, explicit: [...copy.value.explicit, entry] }
  }

  function remove(value: string) {
    if (!copy.value) return
    copy.value = {
      ...copy.value,
      explicit: copy.value.explicit.filter((item) => item.value !== value),
    }
  }

  function setExternalText(value: string) {
    if (copy.value) copy.value = { ...copy.value, externalText: value }
  }

  /** The changed sets after a 412, with their new saved values (FR-027). */
  function changes(before: MailboxSenderSettings, after: MailboxSenderSettings): SectionChange[] {
    const list: SectionChange[] = []
    const values = (settings: MailboxSenderSettings) =>
      settings.explicitPermissions
        .map((entry) => entry.value.toLowerCase())
        .sort()
        .join()
    if (values(before) !== values(after)) {
      list.push({
        field: 'explicitPermissions',
        label: lt('edit.sender_acl'),
        saved: fmt.list(after.explicitPermissions.map(entryLabel)) || '-',
      })
    }
    const external = (settings: MailboxSenderSettings) =>
      settings.externalSenderAddresses
        .map((value) => value.toLowerCase())
        .sort()
        .join()
    if (external(before) !== external(after)) {
      list.push({
        field: 'externalSenderAddresses',
        label: lt('edit.extended_sender_acl'),
        saved: fmt.list(after.externalSenderAddressesUnicode) || '-',
      })
    }
    return list
  }

  async function showFailure(problem: ApiProblem) {
    if (problem.is('attribute-not-permitted')) {
      await problems.setClientMessages({
        externalSenderAddresses: [
          text('senderSettings.errors.externalSenderAddresses.attributeNotPermitted'),
        ],
      })
      return
    }
    await problems.setProblem(problem)
  }

  async function save(): Promise<SenderSaveOutcome> {
    const body = patch.value
    if (!body || !base.value) return 'unchanged'
    sent.value = body
    problems.clear()
    notNeeded.value = []
    const added = (body.explicitPermissions ?? []).filter(
      (value) =>
        !base.value!.explicitPermissions.some(
          (entry) => entry.value.toLowerCase() === value.toLowerCase(),
        ),
    )
    const result = await versioned.save(body, (request, ifMatch) =>
      updateSenderSettings(queryClient, mailbox.value, request, ifMatch),
    )
    if (result.status === 'saved') {
      open(result.result)
      notNeeded.value = notNeededAfterSave(added, result.result)
      return 'saved'
    }
    if (result.status === 'outdated') {
      const latest = result.latest ?? base.value
      outdated.value = changes(base.value, latest)
      return 'outdated'
    }
    if (result.status === 'failed') await showFailure(result.problem)
    return result.status === 'cancelled' ? 'unchanged' : 'failed'
  }

  /** "Save again" after a 412: the reloaded version becomes the base; the working copy stays. */
  function rebase() {
    const latest = versioned.latest.value
    if (latest) base.value = latest
    outdated.value = null
  }

  /** "Discard my changes" after a 412: the working copy takes the reloaded values. */
  function discard() {
    const latest = versioned.discard() ?? base.value
    if (latest) open(latest)
  }

  const settings = computed(() => query.data.value)
  const items = computed(() => {
    const read = settings.value
    if (!read) return { acl: [], external: [] }
    const entries = selectedEntries(read, toWorkingCopy(read))
    return {
      acl: [
        {
          key: 'senderAcl',
          label: lt('edit.sender_acl'),
          value: fmt.list(entries.map(entryLabel)) || '-',
        },
      ],
      external: permissions.value.canEditExternalSenderAddresses
        ? [
            {
              key: 'externalSenderAddresses',
              label: lt('edit.extended_sender_acl'),
              value: fmt.list(read.externalSenderAddressesUnicode) || '-',
            },
          ]
        : [],
    }
  })

  const externalEntryErrors = computed(() => {
    const errors: Record<number, string[]> = {}
    const count = copy.value ? parseEntryList(copy.value.externalText).length : 0
    for (let index = 0; index < count; index += 1) {
      const messages = problems.errorsFor(`externalSenderAddresses.${index}`)
      if (messages.length > 0) errors[index] = messages
    }
    return errors
  })

  /** Errors of the explicit entries by the value sent, so that each chip shows its own. */
  const explicitErrors = computed(() => {
    const errors: Record<string, string[]> = {}
    for (const [index, value] of (sent.value.explicitPermissions ?? []).entries()) {
      const messages = problems.errorsFor(`explicitPermissions.${index}`)
      if (messages.length > 0) errors[value.toLowerCase()] = messages
    }
    return errors
  })

  /**
   * Joins these fields to a section's save (MailboxSection): the sender settings first, then the
   * section's own changes; the status and outdated notice show both.
   */
  function combine(section: {
    status: Ref<SectionStatus | null>
    outdated: Ref<readonly SectionChange[] | null>
    save: () => Promise<void>
    saveAgain: () => Promise<void>
    discard: () => void
  }) {
    async function run(again: boolean) {
      status.value = null
      if (again) rebase()
      const outcome = await save()
      if (outcome === 'failed' || outcome === 'outdated') return
      if (again) await section.saveAgain()
      else await section.save()
      if (outcome !== 'saved') return
      // Legacy's outcome of the save, and the entries the server dropped as not needed (FR-055).
      const notes = notNeeded.value.map((address) => t('senderSettings.notNeeded', { address }))
      if (section.status.value && notes.length === 0) return
      const message = [lt('success.mailbox_modified', mailbox.value), ...notes].join(' ')
      status.value = { kind: notes.length > 0 ? 'info' : 'success', message }
      announce(message)
    }
    return {
      status: computed(() => status.value ?? section.status.value),
      outdated: computed(() => {
        const joined = [...(section.outdated.value ?? []), ...(outdated.value ?? [])]
        return joined.length > 0 ? joined : null
      }),
      save: () => run(false),
      saveAgain: () => run(true),
      discard: () => {
        discard()
        section.discard()
      },
    }
  }

  return {
    query,
    settings,
    copy,
    permissions,
    dirty,
    status,
    notNeeded,
    problems,
    items,
    externalEntryErrors,
    explicitErrors,
    add,
    remove,
    setExternalText,
    save,
    combine,
    t,
  }
}

export type SenderSettingsState = ReturnType<typeof useSenderSettings>
