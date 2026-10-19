<script setup lang="ts">
// Editing a BCC map (UI 009 US5; `templates/edit/bcc.twig`): BCC destination with
// `edit.bcc_dest_format`, type and active, the local destination as the page's description. Save
// sends the changed members with `If-Match`; refusals show legacy's messages; after the save the
// list opens and `success.bcc_edited` is announced. Without the BCC maps permission a domain
// administrator sees the values as text, without controls.
import { useQueryClient } from '@tanstack/vue-query'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { queryKeys, type BccMap, type BccMapType } from '@/api'
import { lt } from '@/i18n'
import FormField from '@/shared/components/FormField.vue'
import LegacyText from '@/shared/components/LegacyText.vue'
import ValueList from '@/shared/components/ValueList.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'

import { fetchBccMap, updateBccMap, useBccMap } from '../../api/bcc-maps'
import { useRoutingCapabilities } from '../../capabilities'
import { bccTypeLabel } from '../../components/bcc-maps/bcc-map-columns'
import EntryEditFrame from '../../components/common/EntryEditFrame.vue'
import { useEntryForm } from '../../composables/useEntryForm'
import { useRoutingIdentity } from '../../composables/useRoutingIdentity'
import { historyTarget } from '../../history'
import { changedMembers, valueText } from '../../logic/changed-fields'
import { conflictOnField } from '../../problems'

const ID = 'bcc-edit'
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const client = useQueryClient()
const capabilities = useRoutingCapabilities()
const { canWriteBcc, canSeeHistory } = useRoutingIdentity()
const id = computed(() => Number(route.params.bccMapId))
const query = useBccMap(id)

interface Form {
  bccDestination: string
  type: BccMapType
  active: boolean
}

const LABELS: Record<string, () => string> = {
  bccDestination: () => lt('mailbox.bcc_destination'),
  type: () => lt('mailbox.bcc_map_type'),
  active: () => lt('edit.active'),
}
const FIELDS = new Set(['bccDestination', 'type', 'active'])

let current = (): Form | null => null
const edit = useEntryForm<BccMap, Form>({
  entry: () => query.data.value,
  refetch: async () => {
    const latest = await fetchBccMap(id.value)
    client.setQueryData(queryKeys.bccMaps.detail(id.value), latest)
    return latest
  },
  toForm: (entry) => ({
    bccDestination: entry.bccDestination,
    type: entry.type,
    active: entry.active,
  }),
  makePatch: (opened, form) =>
    changedMembers(opened, { ...form }, ['bccDestination', 'type', 'active']),
  send: (patch, ifMatch) => updateBccMap(client, id.value, patch, ifMatch),
  outdatedFields: ['bccDestination', 'type', 'active'],
  fieldLabel: (field) => LABELS[field]?.() ?? field,
  fieldValue: (field, value) =>
    field === 'type'
      ? bccTypeLabel(value as BccMapType)
      : typeof value === 'boolean'
        ? t(value ? 'routing.filters.yes' : 'routing.filters.no')
        : valueText(value),
  fieldId: (path) => (FIELDS.has(path) ? `${ID}-${path}` : null),
  formKey: 'routing.bccMaps.form',
  valueAt: (path): string | undefined =>
    path === 'bccDestination' ? current()?.bccDestination.trim() : undefined,
  conflict: (problem, form) =>
    conflictOnField('bccMap', problem, {
      localDestination: query.data.value?.localDestination ?? '',
      type: form.type,
    }),
  onSaved: async (saved) => {
    announce(lt('success.bcc_edited', saved.bccDestination))
    await router.push({ name: 'routing-bcc-maps' })
  },
})
current = () => edit.values.value
useLeaveGuard(edit.dirty, { messageKey: 'leaveGuard.body' })
const values = computed(() => edit.values.value)
const readOnlyItems = computed(() => {
  const entry = query.data.value
  if (!entry) return []
  return [
    { key: 'bccDestination', label: lt('mailbox.bcc_destination'), value: entry.bccDestination },
    { key: 'type', label: lt('mailbox.bcc_map_type'), value: bccTypeLabel(entry.type) },
    {
      key: 'active',
      label: lt('edit.active'),
      value: t(entry.active ? 'routing.filters.yes' : 'routing.filters.no'),
    },
  ]
})
</script>

<template>
  <EntryEditFrame
    list-route="routing-bcc-maps"
    :loaded="!!query.data.value"
    :pending="query.isPending.value"
    :error="query.error.value"
    :description="query.data.value?.localDestination"
    :history="canSeeHistory && query.data.value ? historyTarget('bccMap', query.data.value) : null"
    :summary-id="edit.form.summaryId"
    :summary="edit.form.summary.value"
    :problem="edit.problem.value ?? edit.form.formProblem.value"
    :outdated="edit.outdated.value"
    :saving="edit.pending.value"
    :read-only="!canWriteBcc"
    @submit="edit.save()"
    @save-again="edit.saveAgain()"
    @discard="edit.discard()"
    @retry="query.refetch()"
  >
    <ValueList v-if="!canWriteBcc" :items="readOnlyItems" />
    <template v-else-if="values">
      <FormField
        :id="`${ID}-bccDestination`"
        :label="lt('mailbox.bcc_destination')"
        :errors="edit.form.errorsFor('bccDestination')"
      >
        <template #default="control">
          <input
            v-bind="control"
            v-model="values.bccDestination"
            type="text"
            autocomplete="off"
            autocapitalize="none"
            spellcheck="false"
            :maxlength="capabilities.data.value?.bccMaps.bccDestinationMaxLength"
            :aria-describedby="
              [control['aria-describedby'], `${ID}-bccDestination-info`].filter(Boolean).join(' ')
            "
            class="form-control"
          />
        </template>
      </FormField>
      <LegacyText
        :id="`${ID}-bccDestination-info`"
        k="edit.bcc_dest_format"
        as="small"
        class="-mt-2 text-sm text-gray-600 dark:text-gray-400"
      />
      <FormField
        :id="`${ID}-type`"
        :label="lt('mailbox.bcc_map_type')"
        :errors="edit.form.errorsFor('type')"
      >
        <template #default="control">
          <select
            v-bind="control"
            :value="values.type === 'recipient' ? 'rcpt' : 'sender'"
            class="form-control"
            @change="
              values.type =
                ($event.target as HTMLSelectElement).value === 'rcpt' ? 'recipient' : 'sender'
            "
          >
            <option value="sender">{{ lt('mailbox.bcc_sender_map') }}</option>
            <option value="rcpt">{{ lt('mailbox.bcc_rcpt_map') }}</option>
          </select>
        </template>
      </FormField>
      <label
        class="flex min-h-11 cursor-pointer items-center gap-3 text-gray-800 dark:text-gray-200"
      >
        <input
          :id="`${ID}-active`"
          v-model="values.active"
          type="checkbox"
          class="size-5 accent-brand-500"
        />
        <span>{{ lt('edit.active') }}</span>
      </label>
    </template>
  </EntryEditFrame>
</template>
