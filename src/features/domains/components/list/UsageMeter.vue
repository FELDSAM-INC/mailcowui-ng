<script setup lang="ts">
// A usage pair as text and as a bar (UI 002 research D10, FR-008, FR-076): nearly full from 90 %
// and over the limit are marked by an icon and text, not colour alone; the bar is decorative.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { WarningIcon } from '@/shared/icons'

import { useDomainFormat } from '../../format'
import { usageLevel } from '../../usage'

const props = withDefaults(
  defineProps<{
    label: string
    used: number
    limit: number
    kind: 'count' | 'size'
    usageId?: string
    showLabel?: boolean
    left?: number | null
  }>(),
  { usageId: undefined, showLabel: true, left: null },
)
const { t } = useI18n()
const format = useDomainFormat()

const level = computed(() => usageLevel(props.used, props.limit))
const value = (n: number) => (props.kind === 'size' ? format.size(n) : format.count(n))
const percent = computed(() =>
  props.limit <= 0 ? 100 : Math.min(100, Math.round((props.used / props.limit) * 100)),
)
const barTone = computed(() =>
  level.value === 'over'
    ? 'bg-red-500'
    : level.value === 'nearlyFull'
      ? 'bg-amber-500'
      : 'bg-brand-500',
)
const levelTone = computed(() =>
  level.value === 'over' ? 'text-red-700 dark:text-red-400' : 'text-amber-800 dark:text-amber-300',
)
</script>

<template>
  <div :data-usage="usageId" class="flex min-w-24 flex-col gap-1">
    <div class="flex flex-wrap items-baseline justify-between gap-x-2 text-sm">
      <span v-if="showLabel" class="text-gray-600 dark:text-gray-400">{{ label }}</span>
      <span class="font-medium text-gray-900 dark:text-white">
        <span v-if="!showLabel" class="sr-only">{{ `${label}: ` }}</span>
        {{ t('domains.usage.of', { used: value(used), limit: value(limit) }) }}
      </span>
    </div>
    <div
      data-bar
      aria-hidden="true"
      class="h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
    >
      <div class="h-full rounded-full" :class="barTone" :style="{ width: `${percent}%` }" />
    </div>
    <div class="flex flex-wrap items-center gap-x-3 text-xs">
      <span
        v-if="level !== 'ok'"
        class="inline-flex items-center gap-1 font-medium"
        :class="levelTone"
      >
        <WarningIcon class="size-3.5" />
        {{ t(`domains.usage.${level}`) }}
      </span>
      <span v-if="left !== null" class="text-gray-600 dark:text-gray-400">
        {{ t('domains.usage.left', { count: format.count(left) }) }}
      </span>
    </div>
  </div>
</template>
