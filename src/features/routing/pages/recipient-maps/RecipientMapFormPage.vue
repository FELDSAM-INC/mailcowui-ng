<script setup lang="ts">
// Adding and editing a recipient map (UI 009 US7; `addRecipientMapModalAdmin` and
// `templates/edit/recipient_map.twig`, legacy form map part 1b): original and new recipient with
// legacy's info texts, and active (checked on the add form). Refusals show legacy's messages at
// their fields; saving announces `success.recipient_map_entry_saved` with the stored original
// recipient.
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { problemOf, queryKeys, type RecipientMap } from '@/api'
import { lt, type LegacyKey } from '@/i18n'
import FormField from '@/shared/components/FormField.vue'
import LegacyText from '@/shared/components/LegacyText.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'
import { useProblemForm } from '@/shared/composables/useProblemForm'

import {
  createRecipientMap,
  fetchRecipientMap,
  recipientMapOptions,
  updateRecipientMap,
} from '../../api/recipient-maps'
import { useRoutingCapabilities } from '../../capabilities'
import EntryCreateFrame from '../../components/common/EntryCreateFrame.vue'
import EntryEditFrame from '../../components/common/EntryEditFrame.vue'
import { useEntryForm } from '../../composables/useEntryForm'
import { useRoutingIdentity } from '../../composables/useRoutingIdentity'
import { historyTarget } from '../../history'
import { changedMembers, valueText } from '../../logic/changed-fields'
import { conflictOnField } from '../../problems'

interface Form {
  originalDestination: string
  newDestination: string
  active: boolean
}

const ID = 'recipient-form'
const FIELDS = ['originalDestination', 'newDestination', 'active'] as const
const TEXT_FIELDS: readonly {
  field: 'originalDestination' | 'newDestination'
  label: LegacyKey
  info: LegacyKey
}[] = [
  {
    field: 'originalDestination',
    label: 'mailbox.recipient_map_old',
    info: 'mailbox.recipient_map_old_info',
  },
  {
    field: 'newDestination',
    label: 'mailbox.recipient_map_new',
    info: 'mailbox.recipient_map_new_info',
  },
]
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const client = useQueryClient()
const capabilities = useRoutingCapabilities()
const { canSeeHistory } = useRoutingIdentity()
const maxLength = computed(
  () => capabilities.administration.value?.maxLengths.recipientMapDestination,
)
const creating = computed(() => route.name === 'routing-recipient-map-create')
const id = computed(() => Number(route.params.recipientMapId ?? 0))
const query = useQuery(
  computed(() => ({ ...recipientMapOptions(client, id.value), enabled: !creating.value })),
)
const LABELS: Record<string, () => string> = {
  originalDestination: () => lt('mailbox.recipient_map_old'),
  newDestination: () => lt('mailbox.recipient_map_new'),
  active: () => lt('edit.active'),
}
const fieldId = (path: string) =>
  (FIELDS as readonly string[]).includes(path) ? `${ID}-${path}` : null
/** The value sent at a field, for legacy's `%s`. */
let sentValue = (_path: string): string | undefined => undefined
const conflict = (problem: Parameters<typeof conflictOnField>[1], form: Form) =>
  conflictOnField('recipientMap', problem, {
    originalDestination: form.originalDestination.trim().toLowerCase(),
  })

// The add form.
const draft = ref<Form>({ originalDestination: '', newDestination: '', active: true })
const pending = ref(false)
const createForm = useProblemForm({
  fieldId,
  formKey: 'routing.recipientMaps.form',
  valueAt: (path) => sentValue(path),
})
const entered = computed(
  () => draft.value.originalDestination !== '' || draft.value.newDestination !== '',
)
const guard = useLeaveGuard(() => creating.value && entered.value, {
  messageKey: 'leaveGuard.body',
})

async function create() {
  if (pending.value) return
  createForm.clear()
  pending.value = true
  try {
    const created = await createRecipientMap(client, {
      originalDestination: draft.value.originalDestination.trim(),
      newDestination: draft.value.newDestination.trim(),
      active: draft.value.active,
    })
    guard.disarm()
    announce(lt('success.recipient_map_entry_saved', created.originalDestination))
    await router.replace({ name: 'routing-recipient-maps' })
  } catch (error) {
    const problem = problemOf(error)!
    const onField = conflict(problem, draft.value)
    if (onField) await createForm.setClientMessages(onField)
    else await createForm.setProblem(problem)
  } finally {
    pending.value = false
  }
}

// The edit form.
const edit = useEntryForm<RecipientMap, Form>({
  entry: () => (creating.value ? undefined : query.data.value),
  refetch: async () => {
    const latest = await fetchRecipientMap(id.value)
    client.setQueryData(queryKeys.recipientMaps.detail(id.value), latest)
    return latest
  },
  toForm: (entry) => ({
    originalDestination: entry.originalDestination,
    newDestination: entry.newDestination,
    active: entry.active,
  }),
  makePatch: (opened, form) => changedMembers(opened, { ...form }, [...FIELDS]),
  send: (patch, ifMatch) => updateRecipientMap(client, id.value, patch, ifMatch),
  outdatedFields: [...FIELDS],
  fieldLabel: (field) => LABELS[field]?.() ?? field,
  fieldValue: (_field, value) =>
    typeof value === 'boolean'
      ? t(value ? 'routing.filters.yes' : 'routing.filters.no')
      : valueText(value),
  fieldId,
  formKey: 'routing.recipientMaps.form',
  valueAt: (path) => sentValue(path),
  conflict,
  onSaved: async (saved) => {
    announce(lt('success.recipient_map_entry_saved', saved.originalDestination))
    await router.push({ name: 'routing-recipient-maps' })
  },
})
useLeaveGuard(() => !creating.value && edit.dirty.value, { messageKey: 'leaveGuard.body' })
const values = computed<Form | null>(() => (creating.value ? draft.value : edit.values.value))
sentValue = (path) => {
  const form = values.value
  if (path === 'originalDestination') return form?.originalDestination.trim()
  if (path === 'newDestination') return form?.newDestination.trim()
  return undefined
}
const errorsFor = (path: string) =>
  creating.value ? createForm.errorsFor(path) : edit.form.errorsFor(path)
</script>

<template>
  <component
    :is="creating ? EntryCreateFrame : EntryEditFrame"
    v-bind="
      creating
        ? {
            title: lt('mailbox.add_recipient_map_entry'),
            listRoute: 'routing-recipient-maps',
            summaryId: createForm.summaryId,
            summary: createForm.summary.value,
            problem: createForm.formProblem.value,
            saving: pending,
          }
        : {
            listRoute: 'routing-recipient-maps',
            loaded: !!query.data.value,
            pending: query.isPending.value,
            error: query.error.value,
            description: query.data.value
              ? `${lt('mailbox.recipient_map')}: ${query.data.value.originalDestination}`
              : undefined,
            history:
              canSeeHistory && query.data.value
                ? historyTarget('recipientMap', query.data.value)
                : null,
            summaryId: edit.form.summaryId,
            summary: edit.form.summary.value,
            problem: edit.problem.value ?? edit.form.formProblem.value,
            outdated: edit.outdated.value,
            saving: edit.pending.value,
          }
    "
    @submit="creating ? create() : edit.save()"
    @save-again="edit.saveAgain()"
    @discard="edit.discard()"
    @retry="query.refetch()"
  >
    <template v-if="values">
      <template v-for="item in TEXT_FIELDS" :key="item.field">
        <FormField
          :id="`${ID}-${item.field}`"
          :label="lt(item.label)"
          :errors="errorsFor(item.field)"
        >
          <template #default="control">
            <input
              v-bind="control"
              v-model="values[item.field]"
              type="text"
              autocomplete="off"
              autocapitalize="none"
              spellcheck="false"
              :maxlength="maxLength"
              :aria-describedby="
                [control['aria-describedby'], `${ID}-${item.field}-info`].filter(Boolean).join(' ')
              "
              class="form-control"
            />
          </template>
        </FormField>
        <LegacyText
          :id="`${ID}-${item.field}-info`"
          :k="item.info"
          as="small"
          class="-mt-2 text-sm text-gray-600 dark:text-gray-400"
        />
      </template>
      <label
        class="flex min-h-11 cursor-pointer items-center gap-3 text-gray-800 dark:text-gray-200"
      >
        <input
          :id="`${ID}-active`"
          v-model="values.active"
          type="checkbox"
          class="size-5 accent-brand-500"
        />
        <span>{{ lt(creating ? 'add.active' : 'edit.active') }}</span>
      </label>
    </template>
  </component>
</template>
