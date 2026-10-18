<script setup lang="ts">
// The loading, empty and error states of a collection (constitution II, FR-089). The default slot
// is the content, shown when the collection has entries.
import { useI18n } from 'vue-i18n'

import type { ApiProblem } from '@/api'

import ProblemMessage from './ProblemMessage.vue'

defineProps<{
  loading: boolean
  empty: boolean
  problem: ApiProblem | null
  emptyText?: string
  errorText?: string
}>()
defineEmits<{ retry: [] }>()

const { t } = useI18n()
</script>

<template>
  <div
    v-if="loading"
    role="status"
    aria-busy="true"
    class="py-8 text-center text-gray-600 dark:text-gray-400"
  >
    {{ t('states.list.loading') }}
  </div>
  <div v-else-if="problem" class="flex flex-col gap-3">
    <p role="alert" class="font-medium text-gray-900 dark:text-white">
      {{ errorText ?? t('states.list.error') }}
    </p>
    <ProblemMessage :problem="problem" retry @retry="$emit('retry')" />
  </div>
  <div v-else-if="empty" class="py-8 text-center text-gray-600 dark:text-gray-400">
    <slot name="empty">{{ emptyText ?? t('states.list.empty') }}</slot>
  </div>
  <slot v-else />
</template>
