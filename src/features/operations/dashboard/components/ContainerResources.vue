<script setup lang="ts">
// An expanded container's resource usage (FR-010, legacy Disk I/O and Net I/O charts): polled
// while the container runs and its card is expanded, at the dashboard's interval, with live charts
// of the samples collected while expanded, which are dropped when the card collapses. Rates need
// two samples, so the charts say "Loading..." until then. A container that is not running (or
// stops: `409 container-not-running`) has no resource data.
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { problemOf, type Container } from '@/api'

import { LiveLineChart } from '../../charts'
import { useLiveSeries } from '../../live/useLiveSeries'
import { useResourceUsage } from '../api'
import { useLiveContext } from '../live-context'

const props = defineProps<{ container: Container }>()
const { t } = useI18n()
const live = useLiveContext()
const notRunning = ref(false)

watch(
  () => props.container.running,
  (running) => {
    if (running) notRunning.value = false
  },
)

const enabled = computed(() => props.container.running && !notRunning.value)
const query = useResourceUsage(
  () => props.container.name,
  enabled,
  () => live.interval('resourceUsage'),
)

const disk = useLiveSeries(2)
const network = useLiveSeries(2)
watch(
  () => query.data.value,
  (sample) => {
    if (!sample) return
    disk.push(sample.sampledAt, [sample.disk.readBytesPerSecond, sample.disk.writeBytesPerSecond])
    network.push(sample.sampledAt, [
      sample.network.receiveBytesPerSecond,
      sample.network.sendBytesPerSecond,
    ])
  },
  { immediate: true },
)
watch(
  () => query.error.value,
  (error) => {
    if (problemOf(error)?.is('container-not-running')) {
      notRunning.value = true
      disk.reset()
      network.reset()
    }
  },
)

const diskSeries = computed(() => [
  { name: t('operations.charts.read') },
  { name: t('operations.charts.write') },
])
const netSeries = computed(() => [
  { name: t('operations.charts.recv') },
  { name: t('operations.charts.sent') },
])
</script>

<template>
  <p v-if="!enabled" data-no-resource-data class="text-sm text-gray-700 dark:text-gray-300">
    {{ t('operations.containers.noResourceData') }}
  </p>
  <div v-else class="grid gap-4 md:grid-cols-2" data-resources>
    <div class="min-h-28 min-w-0">
      <LiveLineChart
        :caption="t('operations.charts.diskIo')"
        :series="diskSeries"
        :samples="disk.samples.value"
        kind="rate"
      />
    </div>
    <div class="min-h-28 min-w-0">
      <LiveLineChart
        :caption="t('operations.charts.netIo')"
        :series="netSeries"
        :samples="network.samples.value"
        kind="rate"
      />
    </div>
  </div>
</template>
