<script setup lang="ts">
// The last run result as the classic table shows it (FR-006, FR-007, plan legacy form map): a
// check or a cross with a visually hidden "Succeeded:"/"Failed:", so the result never depends on
// colour alone, and the text of the exit code; "Check log" opens the log where the list offers it.
// No result reads "-", as in the classic table.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { Role, SyncJobRunStatus } from '@/api'
import { resolveText } from '@/i18n'
import { CheckIcon, CloseIcon } from '@/shared/icons'

import { resultView } from '../presentation'

const props = withDefaults(
  defineProps<{ run: SyncJobRunStatus; role: Role; logLink?: boolean }>(),
  { logLink: false },
)
const emit = defineEmits<{ openLog: [] }>()
const { t } = useI18n()
const view = computed(() => resultView(props.run, props.role))
</script>

<template>
  <span data-result class="inline-flex items-start gap-1.5">
    <template v-if="view.kind === 'none'">-</template>
    <template v-else>
      <CheckIcon
        v-if="view.kind === 'succeeded'"
        class="mt-0.5 size-4 shrink-0 text-green-700 dark:text-green-400"
      />
      <CloseIcon v-else class="mt-0.5 size-4 shrink-0 text-red-700 dark:text-red-400" />
      <span>
        <span class="sr-only">{{
          `${t(view.kind === 'succeeded' ? 'syncJobs.result.succeeded' : 'syncJobs.result.failed')} `
        }}</span>
        <button
          v-if="view.checkLog && logLink"
          type="button"
          class="min-h-6 text-start font-medium text-brand-600 underline underline-offset-2 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-brand-400"
          @click="emit('openLog')"
        >
          {{ resolveText(view.text, t) }}
        </button>
        <template v-else>{{ resolveText(view.text, t) }}</template>
      </span>
    </template>
  </span>
</template>
