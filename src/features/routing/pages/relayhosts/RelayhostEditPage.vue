<script setup lang="ts">
// Editing a relayhost (UI 009 US1; `templates/edit/relayhost.twig`): host with
// `add.relayhost_wrapped_tls_info`, username, the write-only password with legacy's
// haveibeenpwned check, and active. Save sends the changed members with `If-Match` as a direct
// client call (research R7); the typed password is cleared after every attempt. After the save
// the list opens and legacy's `success.object_modified` is announced.
import { useQueryClient } from '@tanstack/vue-query'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { ApiProblem, queryKeys, type Relayhost } from '@/api'
import { lt } from '@/i18n'
import FormField from '@/shared/components/FormField.vue'
import LegacyText from '@/shared/components/LegacyText.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'
import { useSecretRequest } from '@/shared/composables/useSecretRequest'

import {
  afterRelayhostWrite,
  fetchRelayhost,
  updateRelayhost,
  useRelayhost,
} from '../../api/relayhosts'
import { useRoutingCapabilities } from '../../capabilities'
import CredentialFields from '../../components/common/CredentialFields.vue'
import EntryEditFrame from '../../components/common/EntryEditFrame.vue'
import { useEntryForm } from '../../composables/useEntryForm'
import { useRoutingIdentity } from '../../composables/useRoutingIdentity'
import { historyTarget } from '../../history'
import { changedMembers, valueText } from '../../logic/changed-fields'
import { credentialIntent, credentialPatch, type CredentialIntent } from '../../logic/credentials'

const ID = 'relayhost-edit'
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const client = useQueryClient()
const capabilities = useRoutingCapabilities()
const { canSeeHistory } = useRoutingIdentity()
const limits = computed(() => capabilities.administration.value?.maxLengths ?? null)
const id = computed(() => Number(route.params.relayhostId))
const query = useRelayhost(id)

interface Form {
  host: string
  active: boolean
  credentials: CredentialIntent
}

const LABELS: Record<string, () => string> = {
  host: () => lt('add.hostname'),
  username: () => lt('add.username'),
  password: () => lt('add.password'),
  active: () => lt('edit.active'),
}
const FIELDS = new Set(['host', 'username', 'password', 'active'])

const secret = useSecretRequest((body: Record<string, unknown>, ifMatch: string) =>
  updateRelayhost(id.value, body, ifMatch),
)

/** The host sent, for legacy's `danger.invalid_host`. */
let hostValue = (): string | undefined => undefined
const edit = useEntryForm<Relayhost, Form>({
  entry: () => query.data.value,
  refetch: async () => {
    const latest = await fetchRelayhost(id.value)
    client.setQueryData(queryKeys.relayhosts.detail(id.value), latest)
    return latest
  },
  toForm: (entry) => ({
    host: entry.host,
    active: entry.active,
    credentials: credentialIntent(entry),
  }),
  makePatch: (opened, form) => ({
    ...changedMembers(opened, { host: form.host, active: form.active }, ['host', 'active']),
    ...credentialPatch(form.credentials),
  }),
  send: async (patch, ifMatch) => {
    const saved = await secret.run(patch, ifMatch)
    if (!saved) throw secret.problem.value ?? ApiProblem.fromParts({ kind: 'network', cause: null })
    return saved
  },
  outdatedFields: ['host', 'username', 'passwordSet', 'active'],
  fieldLabel: (field) =>
    field === 'passwordSet' ? lt('add.password') : (LABELS[field]?.() ?? field),
  fieldValue: (field, value) =>
    field === 'passwordSet'
      ? t(value ? 'routing.credentials.stored' : 'routing.credentials.none')
      : field === 'active'
        ? t(value ? 'routing.filters.yes' : 'routing.filters.no')
        : valueText(value),
  fieldId: (path) => (FIELDS.has(path) ? `${ID}-${path}` : null),
  formKey: 'routing.relayhosts.form',
  valueAt: (path): string | undefined => (path === 'host' ? hostValue() : undefined),
  afterAttempt: (form) => {
    form.credentials = { ...form.credentials, password: '' }
  },
  onSaved: async (saved) => {
    await afterRelayhostWrite(client, saved)
    announce(lt('success.object_modified', saved.host))
    await router.push({ name: 'routing-relayhosts' })
  },
})
hostValue = () => edit.values.value?.host.trim()
useLeaveGuard(edit.dirty, { messageKey: 'leaveGuard.body' })
const values = computed(() => edit.values.value)
</script>

<template>
  <EntryEditFrame
    list-route="routing-relayhosts"
    :loaded="!!query.data.value"
    :pending="query.isPending.value"
    :error="query.error.value"
    :description="query.data.value?.host"
    :history="
      canSeeHistory && query.data.value ? historyTarget('relayhost', query.data.value) : null
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
        :id="`${ID}-host`"
        :label="lt('add.hostname')"
        :errors="edit.form.errorsFor('host')"
      >
        <template #default="control">
          <input
            v-bind="control"
            v-model="values.host"
            type="text"
            autocomplete="off"
            autocapitalize="none"
            spellcheck="false"
            :maxlength="limits?.host"
            :aria-describedby="
              [control['aria-describedby'], `${ID}-host-info`].filter(Boolean).join(' ')
            "
            class="form-control"
          />
        </template>
      </FormField>
      <LegacyText
        :id="`${ID}-host-info`"
        k="add.relayhost_wrapped_tls_info"
        as="p"
        class="-mt-2 text-sm text-gray-600 dark:text-gray-400"
      />
      <CredentialFields
        v-model="values.credentials"
        :id-prefix="ID"
        mode="edit"
        :errors-for="edit.form.errorsFor"
        :max-lengths="limits"
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
        <span>{{ lt('edit.active') }}</span>
      </label>
    </template>
  </EntryEditFrame>
</template>
