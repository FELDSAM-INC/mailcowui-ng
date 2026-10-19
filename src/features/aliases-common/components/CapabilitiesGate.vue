<script setup lang="ts">
// Waits for the feature's capabilities around a form or a bulk bar (research R5, FR-071, spec
// edge case "Capabilities cannot be read"): a skeleton while they load, an error with a retry
// instead of assumed values, then its slot with the capabilities.
import { useI18n } from 'vue-i18n'

import { ApiProblem, isApiProblem, type AliasCapabilities } from '@/api'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'

import { useAliasesCapabilities } from '../capabilities'

defineSlots<{ default: (props: { capabilities: AliasCapabilities }) => unknown }>()
const { t } = useI18n()
const query = useAliasesCapabilities()
const problem = (error: unknown) =>
  isApiProblem(error) ? error : ApiProblem.fromParts({ kind: 'problem', cause: error })
</script>

<template>
  <slot v-if="query.data.value" :capabilities="query.data.value" />
  <div v-else-if="query.isError.value" class="flex flex-col gap-3">
    <p class="font-medium text-gray-900 dark:text-white">{{ t('aliases.capabilities.failed') }}</p>
    <ProblemMessage :problem="problem(query.error.value)" retry @retry="query.refetch()" />
  </div>
  <div v-else data-capabilities-loading role="status" aria-busy="true" class="flex flex-col gap-3">
    <span class="sr-only">{{ t('aliases.capabilities.loading') }}</span>
    <div
      v-for="index in 3"
      :key="index"
      aria-hidden="true"
      class="h-12 rounded-xl bg-gray-100 motion-safe:animate-pulse dark:bg-gray-800"
    />
  </div>
</template>
