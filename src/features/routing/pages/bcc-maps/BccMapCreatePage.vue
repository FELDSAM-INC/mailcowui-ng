<script setup lang="ts">
// Adding a BCC map (UI 009 US5; `addBCCModalAdmin` in `templates/modals/mailbox.twig` on its own
// page): the local destination from the grouped picker, the type (legacy's order: sender, then
// recipient), the BCC destination with `add.bcc_dest_format`, and active (checked). Refusals show
// legacy's messages; after the creation the list opens and `success.bcc_saved` is announced.
// Without the BCC maps permission a domain administrator gets "no access".
import { useQueryClient } from '@tanstack/vue-query'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { problemOf, type BccMapType } from '@/api'
import { lt } from '@/i18n'
import NoAccessState from '@/app/states/NoAccessState.vue'
import FormField from '@/shared/components/FormField.vue'
import LegacyText from '@/shared/components/LegacyText.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'
import { useProblemForm } from '@/shared/composables/useProblemForm'

import { createBccMap } from '../../api/bcc-maps'
import { useRoutingCapabilities } from '../../capabilities'
import BccDestinationPicker from '../../components/bcc-maps/BccDestinationPicker.vue'
import EntryCreateFrame from '../../components/common/EntryCreateFrame.vue'
import { useRoutingIdentity } from '../../composables/useRoutingIdentity'
import { conflictOnField } from '../../problems'

const ID = 'bcc-add'
const { t } = useI18n()
const router = useRouter()
const client = useQueryClient()
const capabilities = useRoutingCapabilities()
const { identity, canWriteBcc } = useRoutingIdentity()

const localDestination = ref<string | null>(null)
const type = ref<BccMapType>('sender')
const bccDestination = ref('')
const active = ref(true)
const pending = ref(false)
const entered = computed(() => !!localDestination.value || bccDestination.value !== '')
const guard = useLeaveGuard(entered, { messageKey: 'leaveGuard.body' })

const FIELDS = new Set(['localDestination', 'type', 'bccDestination', 'active'])
const form = useProblemForm({
  fieldId: (path) => (FIELDS.has(path) ? `${ID}-${path}` : null),
  formKey: 'routing.bccMaps.form',
  valueAt: (path) => (path === 'bccDestination' ? bccDestination.value.trim() : undefined),
})

async function submit() {
  if (pending.value) return
  const errors: Record<string, string[]> = {}
  if (!localDestination.value) errors.localDestination = [t('validation.required')]
  if (bccDestination.value.trim() === '') errors.bccDestination = [lt('danger.bcc_empty')]
  if (Object.keys(errors).length > 0) {
    await form.setClientMessages(errors)
    return
  }
  form.clear()
  pending.value = true
  try {
    await createBccMap(client, {
      localDestination: localDestination.value!,
      type: type.value,
      bccDestination: bccDestination.value.trim(),
      active: active.value,
    })
    guard.disarm()
    announce(lt('success.bcc_saved'))
    await router.replace({ name: 'routing-bcc-maps' })
  } catch (error) {
    const problem = problemOf(error)!
    const onField = conflictOnField('bccMap', problem, {
      localDestination: localDestination.value ?? '',
      type: type.value,
    })
    if (onField) await form.setClientMessages(onField)
    else await form.setProblem(problem)
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <NoAccessState v-if="identity && !canWriteBcc" />
  <EntryCreateFrame
    v-else
    :title="lt('mailbox.add_bcc_entry')"
    list-route="routing-bcc-maps"
    :summary-id="form.summaryId"
    :summary="form.summary.value"
    :problem="form.formProblem.value"
    :saving="pending"
    @submit="submit"
  >
    <BccDestinationPicker
      :id="`${ID}-localDestination`"
      v-model="localDestination"
      :errors="form.errorsFor('localDestination')"
    />
    <FormField
      :id="`${ID}-type`"
      :label="lt('mailbox.bcc_map_type')"
      :errors="form.errorsFor('type')"
    >
      <template #default="control">
        <select
          v-bind="control"
          :value="type === 'recipient' ? 'rcpt' : 'sender'"
          class="form-control"
          @change="
            type = ($event.target as HTMLSelectElement).value === 'rcpt' ? 'recipient' : 'sender'
          "
        >
          <option value="sender">{{ lt('mailbox.bcc_sender_map') }}</option>
          <option value="rcpt">{{ lt('mailbox.bcc_rcpt_map') }}</option>
        </select>
      </template>
    </FormField>
    <FormField
      :id="`${ID}-bccDestination`"
      :label="lt('mailbox.bcc_destination')"
      :errors="form.errorsFor('bccDestination')"
    >
      <template #default="control">
        <input
          v-bind="control"
          v-model="bccDestination"
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
      k="add.bcc_dest_format"
      as="small"
      class="-mt-2 text-sm text-gray-600 dark:text-gray-400"
    />
    <label class="flex min-h-11 cursor-pointer items-center gap-3 text-gray-800 dark:text-gray-200">
      <input
        :id="`${ID}-active`"
        v-model="active"
        type="checkbox"
        class="size-5 accent-brand-500"
      />
      <span>{{ lt('add.active') }}</span>
    </label>
  </EntryCreateFrame>
</template>
