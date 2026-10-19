<script setup lang="ts">
// Adding a forwarding host (UI 009 US8; the add form of `tab-config-fwdhosts.twig`, legacy form
// map part 1b): legacy's hint, the host with legacy's placeholder and the spam filter select
// (`admin.active` by default). A name is resolved by the API into every address; the outcome is
// handed to the list, which opens filtered by the source. A host that does not resolve shows
// legacy's `danger.invalid_host` at the field; a DNS outage offers a retry once `Retry-After` has
// passed.
import { useQueryClient } from '@tanstack/vue-query'
import { computed, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { problemOf, type ApiProblem } from '@/api'
import { lt } from '@/i18n'
import FormField from '@/shared/components/FormField.vue'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'
import { useProblemForm } from '@/shared/composables/useProblemForm'

import { createForwardingHost } from '../../api/forwarding-hosts'
import EntryCreateFrame from '../../components/common/EntryCreateFrame.vue'
import { useForwardingHostResults } from '../../composables/useForwardingHostResults'

const ID = 'fwdhost-add'
const { t } = useI18n()
const router = useRouter()
const client = useQueryClient()
const results = useForwardingHostResults()

const host = ref('')
const spamFilter = ref<'1' | '0'>('1')
const pending = ref(false)
const retryable = ref(false)
let retryTimer: ReturnType<typeof setTimeout> | undefined
const guard = useLeaveGuard(
  computed(() => host.value !== ''),
  { messageKey: 'leaveGuard.body' },
)
const form = useProblemForm({
  fieldId: (path) => (path === 'host' || path === 'spamFilter' ? `${ID}-${path}` : null),
  formKey: 'routing.forwardingHosts.form',
  valueAt: (path) => (path === 'host' ? host.value.trim() : undefined),
})

function offerRetry(problem: ApiProblem) {
  clearTimeout(retryTimer)
  retryable.value = false
  if (problem.status !== 503) return
  retryTimer = setTimeout(() => (retryable.value = true), (problem.retryAfter ?? 0) * 1000)
}
onBeforeUnmount(() => clearTimeout(retryTimer))

async function submit() {
  if (pending.value) return
  if (host.value.trim() === '') {
    await form.setClientErrors({ host: ['validation.required'] })
    return
  }
  form.clear()
  retryable.value = false
  pending.value = true
  try {
    const result = await createForwardingHost(client, {
      host: host.value.trim(),
      spamFilter: spamFilter.value === '1',
    })
    guard.disarm()
    results.hand(result)
    await router.replace({ name: 'routing-forwarding-hosts', query: { source: result.source } })
  } catch (error) {
    const problem = problemOf(error)!
    offerRetry(problem)
    await form.setProblem(problem)
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <EntryCreateFrame
    :title="lt('admin.add_forwarding_host')"
    hint="admin.forwarding_hosts_add_hint"
    list-route="routing-forwarding-hosts"
    :summary-id="form.summaryId"
    :summary="form.summary.value"
    :problem="form.formProblem.value"
    :saving="pending"
    :retry="retryable"
    @submit="submit"
  >
    <FormField :id="`${ID}-host`" :label="lt('admin.host')" :errors="form.errorsFor('host')">
      <template #default="control">
        <input
          v-bind="control"
          v-model="host"
          type="text"
          autocomplete="off"
          autocapitalize="none"
          spellcheck="false"
          :placeholder="t('routing.forwardingHosts.hostPlaceholder')"
          class="form-control"
        />
      </template>
    </FormField>
    <FormField
      :id="`${ID}-spamFilter`"
      :label="lt('user.spamfilter')"
      :errors="form.errorsFor('spamFilter')"
    >
      <template #default="control">
        <select v-bind="control" v-model="spamFilter" class="form-control sm:max-w-52">
          <option value="1">{{ lt('admin.active') }}</option>
          <option value="0">{{ lt('admin.inactive') }}</option>
        </select>
      </template>
    </FormField>
  </EntryCreateFrame>
</template>
