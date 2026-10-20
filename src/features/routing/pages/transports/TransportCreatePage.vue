<script setup lang="ts">
// Adding transports (UI 009 US3; the add form of `templates/admin/tab-routing.twig`): destinations
// in legacy's single field (split as legacy splits them, legacy form map decision 10), next hop,
// username, password, "destination is a regular expression to match against MX name" and active
// (unchecked), with legacy's hints. One direct client call per destination (the body can carry a
// password, research R7); when every destination is created the list opens and legacy's
// `success.relayhost_added` names them; otherwise the results stay on the page and the refused
// destinations stay in the field.
import { useQueryClient } from '@tanstack/vue-query'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { lt } from '@/i18n'
import { useProblemMessages } from '@/i18n/problems'
import BulkResultSummary from '@/shared/components/BulkResultSummary.vue'
import FormField from '@/shared/components/FormField.vue'
import LegacyText from '@/shared/components/LegacyText.vue'
import type { BulkRow } from '@/shared/components/bulk-row'
import { announce } from '@/shared/composables/useAnnouncer'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'
import { useProblemForm } from '@/shared/composables/useProblemForm'

import { afterTransportWrite } from '../../api/transports'
import { useRoutingCapabilities } from '../../capabilities'
import CredentialFields from '../../components/common/CredentialFields.vue'
import EntryCreateFrame from '../../components/common/EntryCreateFrame.vue'
import { useTransportCreateBatch } from '../../composables/useTransportCreateBatch'
import { credentialCreate, credentialIntent } from '../../logic/credentials'
import { splitDestinations } from '../../logic/destinations'
import { conflictOnField, conflictText } from '../../problems'

const ID = 'transport-add'
const { t } = useI18n()
const router = useRouter()
const client = useQueryClient()
const { violationMessageIn } = useProblemMessages()
const capabilities = useRoutingCapabilities()
const limits = computed(() => capabilities.administration.value?.maxLengths ?? null)

const destination = ref('')
const nextHop = ref('')
const mxBased = ref(false)
const active = ref(false)
const credentials = ref(credentialIntent(null))
const entered = computed(
  () =>
    destination.value !== '' ||
    nextHop.value !== '' ||
    credentials.value.username !== '' ||
    credentials.value.password !== '',
)
const guard = useLeaveGuard(entered, { messageKey: 'leaveGuard.body' })

const FIELDS = new Set(['destination', 'nextHop', 'username', 'password', 'mxBased', 'active'])
const form = useProblemForm({
  fieldId: (path) => (FIELDS.has(path) ? `${ID}-${path}` : null),
  formKey: 'routing.transports.form',
})
const batch = useTransportCreateBatch()
const rows = computed(() => batch.rows())

/** A refused destination's reason, as legacy reports it. */
function reason(row: BulkRow): string | null {
  const item = batch.results.value.find((result) => result.destination === row.id)
  if (!item?.problem) {
    return row.outcome === 'done' ? lt('success.relayhost_added', row.id) : null
  }
  const conflict = conflictText('transport', item.problem, {
    destination: item.destination,
    nextHop: nextHop.value.trim(),
  })
  if (conflict) return conflict
  const violation = item.problem.fieldErrors.get('destination')?.[0]
  return violation
    ? violationMessageIn(violation, {
        formKey: 'routing.transports.form',
        path: 'destination',
        valueAt: () => item.destination,
      })
    : null
}

async function submit() {
  if (batch.running.value) return
  const destinations = splitDestinations(destination.value, mxBased.value)
  const errors: Record<string, string[]> = {}
  if (destinations.length === 0) errors.destination = [t('validation.required')]
  if (nextHop.value.trim() === '') errors.nextHop = [lt('danger.invalid_nexthop')]
  if (Object.keys(errors).length > 0) {
    await form.setClientMessages(errors)
    return
  }
  form.clear()
  batch.clear()
  const results = await batch.run(destinations, {
    nextHop: nextHop.value.trim(),
    mxBased: mxBased.value,
    active: active.value,
    ...credentialCreate(credentials.value),
  })
  credentials.value = { ...credentials.value, password: '' }
  const created = results.filter((item) => item.outcome === 'created')
  if (created.length > 0) await afterTransportWrite(client)
  const affected =
    batch.affected.value.length > 0
      ? t('routing.transports.affected', {
          destinations: batch.affected.value.map((item) => item.destination).join(', '),
        })
      : ''
  if (created.length === results.length) {
    guard.disarm()
    announce(
      [lt('success.relayhost_added', created.map((item) => item.destination).join(', ')), affected]
        .filter(Boolean)
        .join(' '),
    )
    await router.replace({ name: 'routing-transports' })
    return
  }
  destination.value = results
    .filter((item) => item.outcome !== 'created')
    .map((item) => item.destination)
    .join(' ')
  const stop = batch.stoppedBy.value
  if (stop && stop.kind !== 'network') {
    const onField = conflictOnField('transport', stop, {
      destination: '',
      nextHop: nextHop.value.trim(),
    })
    if (onField && stop.problemName !== 'routing-entry-exists') {
      await form.setClientMessages(onField)
    } else if (stop.fieldErrors.size > 0 && !stop.fieldErrors.has('destination')) {
      await form.setProblem(stop)
    }
  }
  if (affected) announce(affected)
}
</script>

<template>
  <EntryCreateFrame
    :title="lt('admin.add_transport')"
    hint="admin.add_transports_hint"
    list-route="routing-transports"
    :summary-id="form.summaryId"
    :summary="form.summary.value"
    :problem="form.formProblem.value"
    :saving="batch.running.value"
    @submit="submit"
  >
    <template #before>
      <BulkResultSummary
        v-if="rows.length > 0"
        :rows="rows"
        :message="reason"
        @close="batch.clear()"
      />
      <p
        v-if="batch.affected.value.length > 0"
        role="status"
        class="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
      >
        {{
          t('routing.transports.affected', {
            destinations: batch.affected.value.map((item) => item.destination).join(', '),
          })
        }}
      </p>
    </template>
    <FormField
      :id="`${ID}-destination`"
      :label="lt('admin.destination')"
      :errors="form.errorsFor('destination')"
    >
      <template #default="control">
        <input
          v-bind="control"
          v-model="destination"
          type="text"
          autocomplete="off"
          autocapitalize="none"
          spellcheck="false"
          :placeholder="lt('admin.transport_dest_format')"
          class="form-control"
        />
      </template>
    </FormField>
    <FormField
      :id="`${ID}-nextHop`"
      :label="lt('admin.nexthop')"
      :errors="form.errorsFor('nextHop')"
    >
      <template #default="control">
        <input
          v-bind="control"
          v-model="nextHop"
          type="text"
          autocomplete="off"
          autocapitalize="none"
          spellcheck="false"
          :maxlength="limits?.nextHop"
          :placeholder="t('routing.transports.nextHopPlaceholder')"
          class="form-control"
        />
      </template>
    </FormField>
    <CredentialFields
      v-model="credentials"
      :id-prefix="ID"
      mode="create"
      :errors-for="form.errorsFor"
      :max-lengths="limits"
    />
    <label class="flex min-h-11 cursor-pointer items-start gap-3 text-gray-800 dark:text-gray-200">
      <input
        :id="`${ID}-mxBased`"
        v-model="mxBased"
        type="checkbox"
        class="mt-1 size-5 shrink-0 accent-accent"
      />
      <LegacyText k="admin.lookup_mx" class="wrap-anywhere" />
    </label>
    <label class="flex min-h-11 cursor-pointer items-center gap-3 text-gray-800 dark:text-gray-200">
      <input :id="`${ID}-active`" v-model="active" type="checkbox" class="size-5 accent-accent" />
      <span>{{ lt('admin.active') }}</span>
    </label>
    <LegacyText
      k="admin.credentials_transport_warning"
      as="p"
      class="text-sm text-gray-700 dark:text-gray-300"
    />
  </EntryCreateFrame>
</template>
