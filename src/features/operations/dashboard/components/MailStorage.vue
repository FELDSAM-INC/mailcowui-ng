<script setup lang="ts">
// The mail storage disk of the host card (legacy "Disk usage", FR-006, FR-007): the device, then
// "{used} / {total} ({percent})" in binary units and the usage bar, as legacy composes them. A
// measurement the API reports as unavailable says so instead of showing zeros.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { MailStorageUsage } from '@/api'
import { lt } from '@/i18n'
import { useFormat } from '@/i18n/format'
import { DatabaseIcon } from '@/shared/icons'

import SectionError from '../../live/components/SectionError.vue'

const props = defineProps<{ usage: MailStorageUsage | undefined; failed: boolean }>()
defineEmits<{ retry: [] }>()
const { t } = useI18n()
const fmt = useFormat()

const percent = computed(() => props.usage?.usedPercent ?? 0)
const percentText = computed(() =>
  fmt.number(percent.value / 100, { style: 'percent', maximumFractionDigits: 0 }),
)
</script>

<template>
  <div data-mail-storage>
    <SectionError v-if="failed && !usage" @retry="$emit('retry')" />
    <div
      v-else-if="!usage"
      class="h-12 rounded-lg bg-gray-100 motion-safe:animate-pulse dark:bg-gray-800"
      aria-hidden="true"
    />
    <p v-else-if="!usage.measured" data-unavailable>{{ t('operations.dashboard.unavailable') }}</p>
    <template v-else>
      <span class="flex items-center gap-1.5 wrap-anywhere">
        <DatabaseIcon class="size-4 shrink-0" />{{ usage.device }}
      </span>
      <span class="block tabular-nums">
        {{ fmt.bytes(usage.usedBytes ?? 0) }} / {{ fmt.bytes(usage.totalBytes ?? 0) }} ({{
          percentText
        }})
      </span>
      <div
        role="progressbar"
        :aria-label="lt('debug.disk_usage')"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-valuenow="percent"
        :aria-valuetext="percentText"
        class="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800"
      >
        <div class="h-full rounded-full bg-brand-500" :style="{ width: `${percent}%` }" />
      </div>
    </template>
  </div>
</template>
