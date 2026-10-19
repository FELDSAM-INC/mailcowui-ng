<script setup lang="ts">
// Legacy's "Test Connection" button and its outcome (FR-035 to FR-037): while the test runs the
// button is busy and the progress is announced; the outcome is legacy's alert text
// (`success.iam_test_connection` or `danger.iam_test_connection`) with an icon, plus what legacy
// cannot report: the failure category, the provider's status for an unexpected answer, or that no
// result arrived within the limit. A problem of the request itself is shown as such.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { lt } from '@/i18n'
import type { ApiProblem, IdentityProviderConnectionTestResult } from '@/api'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { CheckIcon, DangerIcon, SyncIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'

import { failureLabelKey } from '../labels'
import { TEST_LIMIT_MS } from '../composables/useConnectionTest'

const props = defineProps<{
  running: boolean
  result: IdentityProviderConnectionTestResult | null
  noResult: boolean
  problem: ApiProblem | null
}>()
const emit = defineEmits<{ test: [] }>()
const { t } = useI18n()

const category = computed(() =>
  props.result?.failureCategory ? t(failureLabelKey(props.result.failureCategory)) : null,
)
const status = computed(() =>
  props.result?.failureCategory === 'unexpectedResponse' && props.result.providerStatus !== null
    ? `${lt('mailbox.status')}: ${props.result.providerStatus}`
    : null,
)
</script>

<template>
  <div class="flex flex-col gap-3" data-connection-test>
    <div>
      <button
        type="button"
        :class="buttonVariants({ variant: 'outline' })"
        :disabled="running"
        :aria-busy="running ? 'true' : undefined"
        @click="emit('test')"
      >
        <SyncIcon v-if="running" class="motion-safe:animate-spin" />
        {{ lt('admin.iam_test_connection') }}
      </button>
    </div>
    <div role="status" aria-live="polite" class="empty:hidden">
      <p v-if="running" class="text-sm text-gray-700 dark:text-gray-300">
        {{ t('identityProvider.test.running') }}
      </p>
      <div
        v-else-if="result"
        data-test-result
        :data-outcome="result.outcome"
        class="flex gap-3 rounded-xl border p-3 text-sm"
        :class="
          result.outcome === 'success'
            ? 'border-green-200 bg-green-50 text-green-900 dark:border-green-900 dark:bg-green-950 dark:text-green-100'
            : 'border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100'
        "
      >
        <CheckIcon v-if="result.outcome === 'success'" class="mt-0.5 size-5 shrink-0" />
        <DangerIcon v-else class="mt-0.5 size-5 shrink-0" />
        <div class="min-w-0">
          <p class="font-medium">
            {{
              result.outcome === 'success'
                ? lt('success.iam_test_connection')
                : lt('danger.iam_test_connection')
            }}
          </p>
          <p v-if="category" class="break-words">{{ category }}</p>
          <p v-if="status" class="break-words">{{ status }}</p>
        </div>
      </div>
      <p v-else-if="noResult" data-test-no-result class="text-sm text-gray-900 dark:text-white">
        {{ t('identityProvider.test.noResult', { seconds: TEST_LIMIT_MS / 1000 }) }}
      </p>
    </div>
    <ProblemMessage :problem="problem" />
  </div>
</template>
