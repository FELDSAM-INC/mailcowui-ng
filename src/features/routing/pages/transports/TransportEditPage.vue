<script setup lang="ts">
// Editing a transport (UI 009 US3; `templates/edit/transport.twig`): destination, next hop with
// legacy's placeholder, username, the write-only password with legacy's haveibeenpwned check,
// "destination is a regular expression to match against MX name" and active. Save sends the
// changed members with `If-Match` as a direct client call (research R7). A taken destination and
// an interfering next hop show legacy's messages at their fields; after the save the list opens,
// legacy's `success.object_modified` is announced, and the other transports whose shared
// credentials changed are named (an outcome legacy cannot report).
import { useQueryClient } from '@tanstack/vue-query'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { ApiProblem, queryKeys, type Transport } from '@/api'
import { lt } from '@/i18n'
import FormField from '@/shared/components/FormField.vue'
import LegacyText from '@/shared/components/LegacyText.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'
import { useSecretRequest } from '@/shared/composables/useSecretRequest'

import {
  afterTransportWrite,
  fetchTransport,
  updateTransport,
  useTransport,
  type TransportWrite,
} from '../../api/transports'
import { useRoutingCapabilities } from '../../capabilities'
import CredentialFields from '../../components/common/CredentialFields.vue'
import EntryEditFrame from '../../components/common/EntryEditFrame.vue'
import { useEntryForm } from '../../composables/useEntryForm'
import { useRoutingIdentity } from '../../composables/useRoutingIdentity'
import { historyTarget } from '../../history'
import { changedMembers, valueText } from '../../logic/changed-fields'
import { credentialIntent, credentialPatch, type CredentialIntent } from '../../logic/credentials'
import { conflictOnField } from '../../problems'

const ID = 'transport-edit'
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const client = useQueryClient()
const capabilities = useRoutingCapabilities()
const { canSeeHistory } = useRoutingIdentity()
const limits = computed(() => capabilities.administration.value?.maxLengths ?? null)
const id = computed(() => Number(route.params.transportId))
const query = useTransport(id)

interface Form {
  destination: string
  nextHop: string
  mxBased: boolean
  active: boolean
  credentials: CredentialIntent
}

const LABELS: Record<string, () => string> = {
  destination: () => lt('add.destination'),
  nextHop: () => lt('edit.nexthop'),
  username: () => lt('add.username'),
  password: () => lt('add.password'),
  passwordSet: () => lt('add.password'),
  mxBased: () => lt('admin.is_mx_based'),
  active: () => lt('edit.active'),
}
const FIELDS = new Set(['destination', 'nextHop', 'username', 'password', 'mxBased', 'active'])

let lastWrite: TransportWrite | null = null
const secret = useSecretRequest((body: Record<string, unknown>, ifMatch: string) =>
  updateTransport(id.value, body, ifMatch),
)

let current = (): Form | null => null
const edit = useEntryForm<Transport, Form>({
  entry: () => query.data.value,
  refetch: async () => {
    const latest = await fetchTransport(id.value)
    client.setQueryData(queryKeys.transports.detail(id.value), latest)
    return latest
  },
  toForm: (entry) => ({
    destination: entry.destination,
    nextHop: entry.nextHop,
    mxBased: entry.mxBased,
    active: entry.active,
    credentials: credentialIntent(entry),
  }),
  makePatch: (opened, form) => ({
    ...changedMembers(
      opened,
      {
        destination: form.destination,
        nextHop: form.nextHop,
        mxBased: form.mxBased,
        active: form.active,
      },
      ['destination', 'nextHop', 'mxBased', 'active'],
    ),
    ...credentialPatch(form.credentials),
  }),
  send: async (patch, ifMatch) => {
    const write = await secret.run(patch, ifMatch)
    if (!write) {
      throw secret.problem.value ?? ApiProblem.fromParts({ kind: 'network', cause: null })
    }
    lastWrite = write
    return write.transport
  },
  outdatedFields: ['destination', 'nextHop', 'mxBased', 'username', 'passwordSet', 'active'],
  fieldLabel: (field) => LABELS[field]?.() ?? field,
  fieldValue: (field, value) =>
    field === 'passwordSet'
      ? t(value ? 'routing.credentials.stored' : 'routing.credentials.none')
      : typeof value === 'boolean'
        ? t(value ? 'routing.filters.yes' : 'routing.filters.no')
        : valueText(value),
  fieldId: (path) => (FIELDS.has(path) ? `${ID}-${path}` : null),
  formKey: 'routing.transports.form',
  valueAt: (path): string | undefined =>
    path === 'destination' ? current()?.destination.trim() : undefined,
  conflict: (problem, form) =>
    conflictOnField('transport', problem, {
      destination: form.destination.trim(),
      nextHop: form.nextHop.trim(),
    }),
  afterAttempt: (form) => {
    form.credentials = { ...form.credentials, password: '' }
  },
  onSaved: async (saved) => {
    await afterTransportWrite(client, saved)
    const others = lastWrite?.affectedTransports ?? []
    announce(
      [
        lt('success.object_modified', saved.destination),
        others.length > 0
          ? t('routing.transports.affected', {
              destinations: others.map((item) => item.destination).join(', '),
            })
          : '',
      ]
        .filter(Boolean)
        .join(' '),
    )
    await router.push({ name: 'routing-transports' })
  },
})
current = () => edit.values.value
useLeaveGuard(edit.dirty, { messageKey: 'leaveGuard.body' })
const values = computed(() => edit.values.value)
</script>

<template>
  <EntryEditFrame
    list-route="routing-transports"
    :loaded="!!query.data.value"
    :pending="query.isPending.value"
    :error="query.error.value"
    :description="query.data.value?.destination"
    :history="
      canSeeHistory && query.data.value ? historyTarget('transport', query.data.value) : null
    "
    :summary-id="edit.form.summaryId"
    :summary="edit.form.summary.value"
    :problem="edit.problem.value ?? edit.form.formProblem.value"
    :outdated="edit.outdated.value"
    :saving="edit.pending.value"
    @submit="edit.save()"
    @save-again="edit.saveAgain()"
    @discard="edit.discard()"
    @retry="query.refetch()"
  >
    <template v-if="values">
      <FormField
        :id="`${ID}-destination`"
        :label="lt('add.destination')"
        :errors="edit.form.errorsFor('destination')"
      >
        <template #default="control">
          <input
            v-bind="control"
            v-model="values.destination"
            type="text"
            autocomplete="off"
            autocapitalize="none"
            spellcheck="false"
            :maxlength="limits?.transportDestination"
            class="form-control"
          />
        </template>
      </FormField>
      <FormField
        :id="`${ID}-nextHop`"
        :label="lt('edit.nexthop')"
        :errors="edit.form.errorsFor('nextHop')"
      >
        <template #default="control">
          <input
            v-bind="control"
            v-model="values.nextHop"
            type="text"
            autocomplete="off"
            autocapitalize="none"
            spellcheck="false"
            :maxlength="limits?.nextHop"
            :placeholder="t('routing.relayhosts.hostPlaceholder')"
            class="form-control"
          />
        </template>
      </FormField>
      <CredentialFields
        v-model="values.credentials"
        :id-prefix="ID"
        mode="edit"
        :errors-for="edit.form.errorsFor"
        :max-lengths="limits"
      />
      <label
        class="flex min-h-11 cursor-pointer items-start gap-3 text-gray-800 dark:text-gray-200"
      >
        <input
          :id="`${ID}-mxBased`"
          v-model="values.mxBased"
          type="checkbox"
          class="mt-1 size-5 shrink-0 accent-accent"
        />
        <LegacyText k="edit.lookup_mx" class="wrap-anywhere" />
      </label>
      <label
        class="flex min-h-11 cursor-pointer items-center gap-3 text-gray-800 dark:text-gray-200"
      >
        <input
          :id="`${ID}-active`"
          v-model="values.active"
          type="checkbox"
          class="size-5 accent-accent"
        />
        <span>{{ lt('edit.active') }}</span>
      </label>
    </template>
  </EntryEditFrame>
</template>
