<script setup lang="ts">
// A translated message for an API problem (FR-075, FR-077, FR-078). The API's English title and
// detail are never shown. Unknown problems show the generic message with the request ID for
// support; a retry action is offered when the caller can retry.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { ApiProblem } from '@/api'
import { hasMessage } from '@/i18n'
import { problemMessageKey, useProblemMessages } from '@/i18n/problems'

import { DangerIcon } from '../icons'
import { buttonVariants } from '../ui/button'

const props = defineProps<{ problem: ApiProblem | null; retry?: boolean }>()
defineEmits<{ retry: [] }>()

const i18n = useI18n()
const t = i18n.t
const { problemMessage } = useProblemMessages()

const message = computed(() => (props.problem ? problemMessage(props.problem) : ''))
const showRequestId = computed(() => {
  const problem = props.problem
  if (!problem?.requestId) return false
  const key = problemMessageKey(problem, hasMessage)
  return key === 'problem.generic' || key.startsWith('problem.status.')
})
</script>

<template>
  <div
    v-if="problem"
    role="alert"
    class="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
  >
    <DangerIcon class="mt-0.5 size-5 shrink-0" />
    <div class="min-w-0 flex-1">
      <p class="break-words">
        <span class="sr-only">{{ `${t('a11y.errorPrefix')} ` }}</span
        >{{ message }}
      </p>
      <p v-if="showRequestId" class="mt-1 text-sm break-all">
        {{ t('common.requestId', { requestId: problem.requestId }) }}
      </p>
      <button
        v-if="retry"
        type="button"
        :class="buttonVariants({ variant: 'outline', class: 'mt-3' })"
        @click="$emit('retry')"
      >
        {{ t('common.retry') }}
      </button>
    </div>
  </div>
</template>
