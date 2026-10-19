<script setup lang="ts">
// The eight steps of a connection test in order (research R12), each with its state in words, so
// that the outcome never depends on colour (FR-070).
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { RoutingConnectionTestResult } from '@/api'

import { stepTimeline } from '../../logic/test-summary'

const props = defineProps<{ result: RoutingConnectionTestResult }>()
const { t } = useI18n()
const steps = computed(() => stepTimeline(props.result))
const TONE: Record<string, string> = {
  passed: 'text-green-700 dark:text-green-400',
  failed: 'text-red-700 dark:text-red-400',
  notReached: 'text-gray-700 dark:text-gray-300',
  notOffered: 'text-gray-700 dark:text-gray-300',
  notConfigured: 'text-gray-700 dark:text-gray-300',
}
</script>

<template>
  <ol class="flex flex-col gap-1 text-sm" data-test-steps>
    <li v-for="item in steps" :key="item.step" class="flex flex-wrap justify-between gap-2">
      <span class="text-gray-900 dark:text-white">{{
        t(`routing.connectionTest.step.${item.step}`)
      }}</span>
      <span :class="TONE[item.state]">{{ t(`routing.connectionTest.state.${item.state}`) }}</span>
    </li>
  </ol>
</template>
