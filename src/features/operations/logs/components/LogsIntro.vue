<script setup lang="ts">
// The top of every log page and of the Rspamd page (plan decision 5): the log choice and legacy's
// explanation `debug.log_info`, with `%d` filled with the configured log length as legacy fills it
// (`LOG_LINES + 1`, which the capabilities report as the in-memory logs' `maxEntries`). The
// explanation waits for the capabilities, so it never shows a made-up length.
import { computed } from 'vue'

import LegacyText from '@/shared/components/LegacyText.vue'

import { useMonitoringCapabilities } from '../../capabilities'
import LogTypeSelect from './LogTypeSelect.vue'

defineProps<{ current: string }>()
const { capabilities } = useMonitoringCapabilities()
const length = computed(() => capabilities.value?.logRetention.postfix.maxEntries ?? null)
</script>

<template>
  <div class="mb-6 flex flex-col gap-4">
    <LogTypeSelect :current="current" />
    <LegacyText
      v-if="length !== null"
      k="debug.log_info"
      :args="[length]"
      as="div"
      data-log-info
      class="flex flex-col gap-2 text-sm text-gray-600 dark:text-gray-400"
    />
  </div>
</template>
