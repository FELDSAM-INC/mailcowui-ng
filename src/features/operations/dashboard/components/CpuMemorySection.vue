<script setup lang="ts">
// Processor and memory (FR-005, legacy CPU and MEMORY blocks): "{cores} Cores @ {usage}" and
// "{total} @ {usage}" as legacy composes them, in binary units, each with a live chart of the
// samples collected while the dashboard is shown. The figures never wait for the chart's chunk.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { HostOverview } from '@/api'
import { lt } from '@/i18n'
import { useFormat } from '@/i18n/format'

import { LiveLineChart } from '../../charts'
import type { ChartSample } from '../../charts/scale'

defineProps<{
  overview: HostOverview | undefined
  cpuSamples: readonly ChartSample[]
  memorySamples: readonly ChartSample[]
}>()
const { t } = useI18n()
const fmt = useFormat()
const percent = (value: number) =>
  fmt.number(value / 100, { style: 'percent', maximumFractionDigits: 1 })

const cpu = computed(() => t('operations.dashboard.cpu'))
const memory = computed(() => lt('debug.memory'))
</script>

<template>
  <div class="grid gap-6 md:grid-cols-2" data-cpu-memory>
    <section class="flex min-w-0 flex-col gap-2" aria-labelledby="ops-cpu-heading">
      <h3 id="ops-cpu-heading" class="text-lg font-semibold text-gray-900 dark:text-white">
        {{ cpu }}
      </h3>
      <p data-cpu class="min-h-6 tabular-nums">
        <template v-if="overview">
          {{ fmt.number(overview.cpu.cores) }} {{ lt('debug.cores') }} @
          {{ percent(overview.cpu.usagePercent) }}
        </template>
        <span
          v-else
          class="block h-6 w-40 rounded bg-gray-100 motion-safe:animate-pulse dark:bg-gray-800"
          aria-hidden="true"
        />
      </p>
      <div class="min-h-28">
        <LiveLineChart
          :caption="cpu"
          :series="[{ name: cpu }]"
          :samples="cpuSamples"
          kind="percent"
        />
      </div>
    </section>
    <section class="flex min-w-0 flex-col gap-2" aria-labelledby="ops-memory-heading">
      <h3 id="ops-memory-heading" class="text-lg font-semibold text-gray-900 dark:text-white">
        {{ memory }}
      </h3>
      <p data-memory class="min-h-6 tabular-nums">
        <template v-if="overview">
          {{ fmt.bytes(overview.memory.totalBytes) }} @
          {{ percent(overview.memory.usagePercent) }}
        </template>
        <span
          v-else
          class="block h-6 w-40 rounded bg-gray-100 motion-safe:animate-pulse dark:bg-gray-800"
          aria-hidden="true"
        />
      </p>
      <div class="min-h-28">
        <LiveLineChart
          :caption="memory"
          :series="[{ name: memory }]"
          :samples="memorySamples"
          kind="percent"
        />
      </div>
    </section>
  </div>
</template>
