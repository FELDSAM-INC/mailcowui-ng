<script setup lang="ts">
import { problemOf } from '@/api'
import { lt } from '@/i18n'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { useActiveScript } from '../api'
import ScriptBlock from './ScriptBlock.vue'
const props = defineProps<{ mailbox: string }>()
const query = useActiveScript(() => props.mailbox)
</script>
<template>
  <p v-if="query.isPending.value" role="status" aria-busy="true">{{ lt('user.loading') }}</p>
  <ProblemMessage
    v-else-if="query.isError.value"
    :problem="problemOf(query.error.value)"
    retry
    @retry="query.refetch()"
  />
  <p v-else-if="query.data.value?.script === null" role="status">
    {{ lt('user.no_active_filter') }}
  </p>
  <div v-else-if="query.data.value" class="flex min-w-0 flex-col gap-4">
    <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ query.data.value.name }}</h2>
    <ScriptBlock :script="query.data.value.script ?? ''" />
  </div>
</template>
