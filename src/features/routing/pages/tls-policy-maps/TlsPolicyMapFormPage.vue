<script setup lang="ts">
// Adding and editing a TLS policy map (UI 009 US6; `addTLSPolicyMapAdmin` and
// `templates/edit/tls_policy_map.twig`, legacy form map part 1b): destination with
// `mailbox.tls_map_dest_info`, the policy as legacy's select of the raw values (in the order of
// the server's `tlsPolicies`), parameters with `mailbox.tls_map_parameters_info`, and active
// (checked on the add form). Refusals show legacy's messages at their fields; saving announces
// `success.tls_policy_map_entry_saved`.
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { problemOf, queryKeys, type TlsPolicy, type TlsPolicyMap } from '@/api'
import { lt } from '@/i18n'
import FormField from '@/shared/components/FormField.vue'
import LegacyText from '@/shared/components/LegacyText.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'
import { useProblemForm } from '@/shared/composables/useProblemForm'

import {
  createTlsPolicyMap,
  fetchTlsPolicyMap,
  tlsPolicyMapOptions,
  updateTlsPolicyMap,
} from '../../api/tls-policy-maps'
import { useRoutingCapabilities } from '../../capabilities'
import EntryCreateFrame from '../../components/common/EntryCreateFrame.vue'
import EntryEditFrame from '../../components/common/EntryEditFrame.vue'
import { useEntryForm } from '../../composables/useEntryForm'
import { useRoutingIdentity } from '../../composables/useRoutingIdentity'
import { historyTarget } from '../../history'
import { changedMembers, valueText } from '../../logic/changed-fields'
import { conflictOnField } from '../../problems'

interface Form {
  destination: string
  policy: TlsPolicy
  parameters: string
  active: boolean
}

const ID = 'tls-form'
const FIELDS = ['destination', 'policy', 'parameters', 'active'] as const
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const client = useQueryClient()
const capabilities = useRoutingCapabilities()
const { canSeeHistory } = useRoutingIdentity()
const limits = computed(() => capabilities.administration.value?.maxLengths ?? null)
const policies = computed<TlsPolicy[]>(() => capabilities.administration.value?.tlsPolicies ?? [])
const creating = computed(() => route.name === 'routing-tls-policy-map-create')
const id = computed(() => Number(route.params.tlsPolicyMapId ?? 0))
const query = useQuery(
  computed(() => ({ ...tlsPolicyMapOptions(client, id.value), enabled: !creating.value })),
)
const LABELS: Record<string, () => string> = {
  destination: () => lt('mailbox.tls_map_dest'),
  policy: () => lt('mailbox.tls_map_policy'),
  parameters: () => lt('mailbox.tls_map_parameters'),
  active: () => lt('edit.active'),
}
const fieldId = (path: string) =>
  (FIELDS as readonly string[]).includes(path) ? `${ID}-${path}` : null
const conflict = (problem: Parameters<typeof conflictOnField>[1], form: Form) =>
  conflictOnField('tlsPolicyMap', problem, { destination: form.destination.trim().toLowerCase() })

// The add form.
const draft = ref<Form>({ destination: '', policy: 'none', parameters: '', active: true })
const pending = ref(false)
const createForm = useProblemForm({ fieldId, formKey: 'routing.tlsPolicyMaps.form' })
const entered = computed(() => draft.value.destination !== '' || draft.value.parameters !== '')
const guard = useLeaveGuard(() => creating.value && entered.value, {
  messageKey: 'leaveGuard.body',
})

async function create() {
  if (pending.value) return
  if (draft.value.destination.trim() === '') {
    await createForm.setClientMessages({ destination: [lt('danger.tls_policy_map_dest_invalid')] })
    return
  }
  createForm.clear()
  pending.value = true
  try {
    const created = await createTlsPolicyMap(client, {
      destination: draft.value.destination.trim(),
      policy: draft.value.policy,
      parameters: draft.value.parameters.trim(),
      active: draft.value.active,
    })
    guard.disarm()
    announce(lt('success.tls_policy_map_entry_saved', created.destination))
    await router.replace({ name: 'routing-tls-policy-maps' })
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
const edit = useEntryForm<TlsPolicyMap, Form>({
  entry: () => (creating.value ? undefined : query.data.value),
  refetch: async () => {
    const latest = await fetchTlsPolicyMap(id.value)
    client.setQueryData(queryKeys.tlsPolicyMaps.detail(id.value), latest)
    return latest
  },
  toForm: (entry) => ({
    destination: entry.destination,
    policy: entry.policy,
    parameters: entry.parameters,
    active: entry.active,
  }),
  makePatch: (opened, form) => changedMembers(opened, { ...form }, [...FIELDS]),
  send: (patch, ifMatch) => updateTlsPolicyMap(client, id.value, patch, ifMatch),
  outdatedFields: [...FIELDS],
  fieldLabel: (field) => LABELS[field]?.() ?? field,
  fieldValue: (field, value) =>
    typeof value === 'boolean'
      ? t(value ? 'routing.filters.yes' : 'routing.filters.no')
      : valueText(value) || '-',
  fieldId,
  formKey: 'routing.tlsPolicyMaps.form',
  conflict,
  onSaved: async (saved) => {
    announce(lt('success.tls_policy_map_entry_saved', saved.destination))
    await router.push({ name: 'routing-tls-policy-maps' })
  },
})
useLeaveGuard(() => !creating.value && edit.dirty.value, { messageKey: 'leaveGuard.body' })
const values = computed<Form | null>(() => (creating.value ? draft.value : edit.values.value))
const errorsFor = (path: string) =>
  creating.value ? createForm.errorsFor(path) : edit.form.errorsFor(path)
</script>

<template>
  <component
    :is="creating ? EntryCreateFrame : EntryEditFrame"
    v-bind="
      creating
        ? {
            title: lt('mailbox.add_tls_policy_map'),
            listRoute: 'routing-tls-policy-maps',
            summaryId: createForm.summaryId,
            summary: createForm.summary.value,
            problem: createForm.formProblem.value,
            saving: pending,
          }
        : {
            listRoute: 'routing-tls-policy-maps',
            loaded: !!query.data.value,
            pending: query.isPending.value,
            error: query.error.value,
            description: query.data.value
              ? `${lt('mailbox.tls_policy_maps')}: ${query.data.value.destination}`
              : undefined,
            history:
              canSeeHistory && query.data.value
                ? historyTarget('tlsPolicyMap', query.data.value)
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
      <FormField
        :id="`${ID}-destination`"
        :label="lt('mailbox.tls_map_dest')"
        :errors="errorsFor('destination')"
      >
        <template #default="control">
          <input
            v-bind="control"
            v-model="values.destination"
            type="text"
            autocomplete="off"
            autocapitalize="none"
            spellcheck="false"
            :maxlength="limits?.tlsPolicyDestination"
            :aria-describedby="
              [control['aria-describedby'], `${ID}-destination-info`].filter(Boolean).join(' ')
            "
            class="form-control"
          />
        </template>
      </FormField>
      <LegacyText
        :id="`${ID}-destination-info`"
        k="mailbox.tls_map_dest_info"
        as="small"
        class="-mt-2 text-sm text-gray-600 dark:text-gray-400"
      />
      <FormField
        :id="`${ID}-policy`"
        :label="lt('mailbox.tls_map_policy')"
        :errors="errorsFor('policy')"
      >
        <template #default="control">
          <select v-bind="control" v-model="values.policy" class="form-control" translate="no">
            <option v-for="policy in policies" :key="policy" :value="policy">{{ policy }}</option>
          </select>
        </template>
      </FormField>
      <FormField
        :id="`${ID}-parameters`"
        :label="lt('mailbox.tls_map_parameters')"
        :errors="errorsFor('parameters')"
      >
        <template #default="control">
          <input
            v-bind="control"
            v-model="values.parameters"
            type="text"
            autocomplete="off"
            autocapitalize="none"
            spellcheck="false"
            :maxlength="limits?.tlsPolicyParameters"
            :aria-describedby="
              [control['aria-describedby'], `${ID}-parameters-info`].filter(Boolean).join(' ')
            "
            class="form-control"
          />
        </template>
      </FormField>
      <LegacyText
        :id="`${ID}-parameters-info`"
        k="mailbox.tls_map_parameters_info"
        as="small"
        class="-mt-2 text-sm text-gray-600 dark:text-gray-400"
      />
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
