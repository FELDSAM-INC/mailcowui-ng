<script setup lang="ts">
import { Badge } from '@/shared/ui/badge'

// "Allow to send as" (`edit.sender_acl`), the classic page's multi-select, searchable as legacy's
// live search but against the server (FR-050, 5,000 entries and more): the selected entries with
// legacy's labels and subtexts, removable where the user may change them; the options are the
// grantable entries the server offers (`*` for administrators only) and the aliases that deliver
// to the mailbox without allowing sending ("Alias (blocked)"). While `*` is selected legacy's
// `edit.sender_acl_disabled` shows; `edit.sender_acl_info` follows. Entries the server refuses are
// marked with legacy's message (US5-AS7), and entries it dropped as not needed are named (FR-055).
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { queryKeys, type MailboxSenderPermissionCandidate } from '@/api'
import { lt } from '@/i18n'
import DomainPicker, {
  type DomainPickerOption,
  type DomainPickerSource,
} from '@/shared/components/DomainPicker.vue'
import LegacyText from '@/shared/components/LegacyText.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { CloseIcon, InfoIcon } from '@/shared/icons'

import { fetchCandidates } from '../api'
import { entryLabel, useSubtextLabel } from '../labels'
import { blockedAliases, selectedEntries, type SenderEntry } from '../send-as-model'
import { SENDER_ACL_ID, type SenderSettingsState } from '../useSenderSettings'

const props = defineProps<{ state: SenderSettingsState }>()
const { t } = useI18n()
const subtextLabel = useSubtextLabel()

const read = computed(() => props.state.settings.value)
const copy = computed(() => props.state.copy.value)
const entries = computed(() =>
  read.value && copy.value ? selectedEntries(read.value, copy.value) : [],
)
const anyAddress = computed(() => entries.value.some((entry) => entry.value === '*'))
const values = computed(() => copy.value?.explicit.map((entry) => entry.value) ?? [])
const types = computed<('address' | 'domain' | 'anyAddress')[]>(() =>
  props.state.permissions.value.canGrantAnyAddress
    ? ['address', 'domain', 'anyAddress']
    : ['address', 'domain'],
)

/** The entries the options were built from, to know their type and kind when one is chosen. */
const known = new Map<string, SenderEntry>()

// The picker builds one query per source when it mounts; the sources read the current settings,
// working copy and types each time, so the queries follow them. The mailbox is the page's, which
// is known before its settings have loaded.
const blocked = computed(() =>
  read.value && copy.value ? blockedAliases(read.value, copy.value) : [],
)
const sources: DomainPickerSource[] = [
  {
    id: 'blocked',
    queryKey: (q) => [
      'sender-settings',
      'blocked',
      props.state.mailbox.value,
      blocked.value.map((entry) => entry.value),
      q,
    ],
    fetchPage: ({ q }) => {
      const needle = q.toLowerCase()
      const items = blocked.value
        .filter((entry) => !needle || entry.valueUnicode.toLowerCase().includes(needle))
        .map((entry) => {
          known.set(entry.value, { ...entry, kind: 'alias', changeable: true, stale: false })
          return {
            name: entry.value,
            nameUnicode: entry.valueUnicode,
            note: subtextLabel('aliasBlocked') ?? undefined,
          }
        })
      return Promise.resolve({ items, total: items.length })
    },
  },
  {
    id: 'candidates',
    queryKey: (q) =>
      queryKeys.senderPermissionCandidates({
        mailbox: props.state.mailbox.value,
        q,
        type: types.value,
      }),
    fetchPage: async ({ q, offset, limit }) => {
      const page = await fetchCandidates({
        mailbox: props.state.mailbox.value,
        type: types.value,
        limit,
        offset,
        ...(q ? { q } : {}),
      })
      return {
        items: page.items.map((candidate: MailboxSenderPermissionCandidate) => {
          known.set(candidate.value, { ...candidate, changeable: true, stale: false })
          return { name: candidate.value, nameUnicode: entryLabel(candidate) }
        }),
        total: page.total,
      }
    },
  },
]

function onPick(option: DomainPickerOption) {
  const entry = known.get(option.name)
  if (entry) props.state.add(entry)
}

const errorsOf = (value: string) => props.state.explicitErrors.value[value.toLowerCase()] ?? []
const fieldErrors = computed(() => props.state.problems.errorsFor('explicitPermissions'))
</script>

<template>
  <div
    :id="SENDER_ACL_ID"
    role="group"
    :aria-label="lt('edit.sender_acl')"
    tabindex="-1"
    class="flex min-w-0 flex-col gap-2 focus:outline-none"
    data-sender-acl
  >
    <ProblemMessage :problem="state.problems.formProblem.value" />
    <DomainPicker
      :id="`${SENDER_ACL_ID}-search`"
      :label="lt('edit.sender_acl')"
      :sources="sources"
      :model-value="values"
      :errors="fieldErrors"
      multiple
      hide-chips
      @pick="onPick"
    />
    <ul v-if="entries.length > 0" class="flex flex-col gap-2">
      <li
        v-for="entry in entries"
        :key="entry.value"
        :data-sender-entry="entry.value"
        class="flex min-w-0 flex-col gap-1 rounded-xl border border-gray-200 px-3 py-2 dark:border-gray-800"
        :class="errorsOf(entry.value).length > 0 ? 'border-red-300 dark:border-red-800' : ''"
      >
        <div class="flex min-w-0 items-start gap-2">
          <div class="flex min-w-0 flex-1 flex-col">
            <span class="break-words text-gray-900 dark:text-white">{{ entryLabel(entry) }}</span>
            <span
              v-if="entry.subtext"
              data-subtext
              class="text-sm text-gray-600 dark:text-gray-400"
              >{{ subtextLabel(entry.subtext) }}</span
            >
          </div>
          <button
            v-if="entry.removable"
            type="button"
            class="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-gray-300 dark:hover:bg-gray-800"
            :aria-label="t('pickers.remove', { name: entryLabel(entry) })"
            @click="state.remove(entry.value)"
          >
            <CloseIcon class="size-5" />
          </button>
        </div>
        <p
          v-for="(message, index) in errorsOf(entry.value)"
          :key="index"
          class="text-sm break-words text-red-700 dark:text-red-300"
        >
          <span class="sr-only">{{ `${t('a11y.errorPrefix')} ` }}</span
          >{{ message }}
        </p>
      </li>
    </ul>
    <Badge v-if="anyAddress" data-sender-check-disabled color="error"
      ><LegacyText k="edit.sender_acl_disabled"
    /></Badge>
    <ul v-if="state.notNeeded.value.length > 0" class="flex flex-col gap-1" data-not-needed>
      <li
        v-for="value in state.notNeeded.value"
        :key="value"
        class="flex gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-100"
      >
        <InfoIcon class="mt-0.5 size-4 shrink-0" />
        <span class="min-w-0 break-words">{{
          t('senderSettings.notNeeded', { address: value })
        }}</span>
      </li>
    </ul>
    <LegacyText k="edit.sender_acl_info" as="p" class="text-sm text-gray-600 dark:text-gray-400" />
  </div>
</template>
