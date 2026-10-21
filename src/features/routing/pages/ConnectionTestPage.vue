<script setup lang="ts">
// The connection test of a relayhost or transport (UI 009 US4; `testTransportModal` in
// `templates/modals/admin.twig` on its own page, legacy form map part 1b): headed "Transport" as
// legacy hard-codes it, with the entry's host or next hop; legacy's "From:" (empty, the server's
// default sender as placeholder) and "To:" (prefilled with the server's default recipient, as
// legacy prefills it) with `admin.transport_test_rcpt_info`; `admin.relay_run`; then the result,
// verdict first, the steps and the transcript. Nothing runs on load: a test sends real mail.
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, nextTick, onScopeDispose, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'

import { isApiProblem, type RoutingConnectionTestRequest } from '@/api'
import { lt } from '@/i18n'
import NotFoundPage from '@/app/states/NotFoundPage.vue'
import FormField from '@/shared/components/FormField.vue'
import LegacyText from '@/shared/components/LegacyText.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import { useProblemForm } from '@/shared/composables/useProblemForm'
import { buttonVariants } from '@/shared/ui/button'

import type { ConnectionTestKind } from '../api/connection-test'
import { relayhostOptions } from '../api/relayhosts'
import { transportOptions } from '../api/transports'
import { useRoutingCapabilities } from '../capabilities'
import ConnectionTestSteps from '../components/connection-test/ConnectionTestSteps.vue'
import ConnectionTestSummary from '../components/connection-test/ConnectionTestSummary.vue'
import ConnectionTranscript from '../components/connection-test/ConnectionTranscript.vue'
import { relayhostName } from '../components/relayhosts/relayhost-columns'
import { useConnectionTest } from '../composables/useConnectionTest'

const props = defineProps<{ kind: ConnectionTestKind }>()
const ID = 'connection-test'
const { t } = useI18n()
const route = useRoute()
const capabilities = useRoutingCapabilities()
const settings = computed(() => capabilities.administration.value?.connectionTest ?? null)

const id = computed(() =>
  Number(props.kind === 'relayhost' ? route.params.relayhostId : route.params.transportId),
)
const client = useQueryClient()
const relayhost = useQuery(
  computed(() => ({ ...relayhostOptions(client, id.value), enabled: props.kind === 'relayhost' })),
)
const transport = useQuery(
  computed(() => ({ ...transportOptions(client, id.value), enabled: props.kind === 'transport' })),
)
const entry = computed(() => (props.kind === 'relayhost' ? relayhost : transport))
const description = computed(() => {
  if (props.kind === 'relayhost')
    return relayhost.data.value ? relayhostName(relayhost.data.value) : ''
  return transport.data.value
    ? `${transport.data.value.destination} → ${transport.data.value.nextHop}`
    : ''
})
const listRoute = computed(() =>
  props.kind === 'relayhost' ? 'routing-relayhosts' : 'routing-transports',
)
const notFound = computed(() => {
  const query = entry.value
  return !query.data.value && isApiProblem(query.error.value) && query.error.value.status === 404
})

const sender = ref('')
const recipient = ref('')
let prefilled = false
watch(
  settings,
  (value) => {
    if (value && !prefilled) {
      recipient.value = value.defaultRecipient
      prefilled = true
    }
  },
  { immediate: true },
)

const test = useConnectionTest({
  kind: () => props.kind,
  id: () => id.value,
  totalTimeoutSeconds: () => settings.value?.totalTimeoutSeconds,
})
const form = useProblemForm({
  fieldId: (path) => (path === 'sender' || path === 'recipient' ? `${ID}-${path}` : null),
})
const formRoot = ref<HTMLFormElement | null>(null)
const summary = ref<{ reveal(): void } | null>(null)
let ownsResultFocus = false
let disposed = false

function clearResultFocus() {
  ownsResultFocus = false
  document.removeEventListener('focusin', onPendingFocus)
}

function onPendingFocus(event: FocusEvent) {
  // Disabling Run test can blur it to body. Deliberate focus outside the form relinquishes
  // ownership, so a slow test cannot pull the user back from another control.
  if (event.target !== document.body && !formRoot.value?.contains(event.target as Node)) {
    clearResultFocus()
  }
}

onScopeDispose(() => {
  disposed = true
  clearResultFocus()
})

/** legacy accepts what PHP's e-mail filter accepts; the app checks one `@` with text on both sides. */
const looksLikeEmail = (value: string) => /^[^\s@]+@[^\s@]+$/.test(value)

async function run(event: Event) {
  if (test.running.value) return
  const body: RoutingConnectionTestRequest = {}
  const errors: Record<string, string[]> = {}
  for (const [field, value] of [
    ['sender', sender.value.trim()],
    ['recipient', recipient.value.trim()],
  ] as const) {
    if (value === '') continue
    if (!looksLikeEmail(value)) errors[field] = [t('validation.format.email')]
    else body[field] = value
  }
  if (Object.keys(errors).length > 0) {
    await form.setClientMessages(errors)
    return
  }
  form.clear()
  clearResultFocus()
  // Safari pointer activation need not focus the submit button; its submitter still identifies
  // the user's request. Keyboard submission can instead leave focus on a field in the form.
  ownsResultFocus =
    !!formRoot.value?.contains(document.activeElement) ||
    (event instanceof SubmitEvent && !!formRoot.value?.contains(event.submitter))
  if (ownsResultFocus) document.addEventListener('focusin', onPendingFocus)
  try {
    await test.run(body)
    if (disposed) return
    if (test.result.value) {
      announce(
        t(
          `routing.connectionTest.verdict.${test.result.value.accepted ? 'accepted' : 'notAccepted'}`,
        ),
      )
      await nextTick()
      if (ownsResultFocus) summary.value?.reveal()
    } else if (test.state.value === 'noResult') {
      announce(t('routing.connectionTest.noResult'), { assertive: true })
    } else if (test.problem.value) {
      await form.setProblem(test.problem.value)
    }
  } finally {
    clearResultFocus()
  }
}
</script>

<template>
  <NotFoundPage
    v-if="notFound"
    :back-to="{ name: listRoute }"
    :back-label="t('routing.common.backToList')"
  />
  <section v-else class="mx-auto flex w-full max-w-3xl flex-col gap-4">
    <RouterLink
      :to="{ name: listRoute }"
      class="inline-flex min-h-11 items-center self-start text-sm font-medium text-accent-text bg-white dark:bg-gray-900 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500"
    >
      <span aria-hidden="true">←&nbsp;</span>{{ lt('edit.previous') }}
    </RouterLink>
    <PageHeader :title="t('routing.connectionTest.title')" :description="description" />
    <form
      ref="formRoot"
      data-test-form
      class="flex min-w-0 flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 dark:border-gray-800 dark:bg-gray-900"
      novalidate
      @submit.prevent="run"
    >
      <ProblemMessage :problem="form.formProblem.value" />
      <FormField
        :id="`${ID}-sender`"
        :label="lt('admin.relay_from')"
        :errors="form.errorsFor('sender')"
      >
        <template #default="control">
          <input
            v-bind="control"
            v-model="sender"
            type="email"
            autocomplete="off"
            autocapitalize="none"
            spellcheck="false"
            :maxlength="capabilities.administration.value?.maxLengths.testSender"
            :placeholder="settings?.defaultSender"
            class="form-control"
          />
        </template>
      </FormField>
      <FormField
        :id="`${ID}-recipient`"
        :label="lt('admin.relay_rcpt')"
        :errors="form.errorsFor('recipient')"
      >
        <template #default="control">
          <input
            v-bind="control"
            v-model="recipient"
            type="email"
            autocomplete="off"
            autocapitalize="none"
            spellcheck="false"
            :maxlength="capabilities.administration.value?.maxLengths.testRecipient"
            :placeholder="settings?.defaultRecipient"
            :aria-describedby="
              [control['aria-describedby'], `${ID}-recipient-info`].filter(Boolean).join(' ')
            "
            class="form-control"
          />
        </template>
      </FormField>
      <LegacyText
        :id="`${ID}-recipient-info`"
        k="admin.transport_test_rcpt_info"
        as="p"
        class="-mt-2 text-sm text-gray-600 dark:text-gray-400"
      />
      <div>
        <button
          type="submit"
          :class="buttonVariants({ variant: 'outline' })"
          :disabled="test.running.value"
          :aria-busy="test.running.value ? 'true' : 'false'"
        >
          {{ test.running.value ? lt('footer.loading') : lt('admin.relay_run') }}
        </button>
      </div>
    </form>
    <hr class="border-gray-200 dark:border-gray-800" />
    <p
      v-if="test.state.value === 'noResult'"
      role="alert"
      class="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
    >
      {{ t('routing.connectionTest.noResult') }}
    </p>
    <template v-if="test.result.value">
      <ConnectionTestSummary ref="summary" :result="test.result.value" />
      <ConnectionTestSteps :result="test.result.value" />
      <ConnectionTranscript :lines="test.result.value.transcript" />
    </template>
  </section>
</template>
