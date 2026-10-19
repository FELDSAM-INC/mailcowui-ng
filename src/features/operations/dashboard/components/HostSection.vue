<script setup lang="ts">
// The host card (legacy `#tab-containers` first card, FR-004–FR-007), in legacy's order:
// Hostname, Architecture, IPs, Version, System Time, Timezone, Uptime, Disk usage; then the CPU and
// memory blocks. Its heading is the branding's UI title, as legacy's card header. The overview rows
// and blocks need the host overview; the IPs, the version and the disk usage have reads of their
// own, so one failing read never hides the others (FR-025).
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useBranding } from '@/app/branding/public-config'
import type { HostOverview, MailStorageUsage } from '@/api'
import { lt } from '@/i18n'
import { useFormat } from '@/i18n/format'
import { toBcp47 } from '@/i18n/locales'

import SectionError from '../../live/components/SectionError.vue'
import type { ChartSample } from '../../charts/scale'
import CpuMemorySection from './CpuMemorySection.vue'
import MailStorage from './MailStorage.vue'
import PublicAddresses from './PublicAddresses.vue'
import VersionLine from './VersionLine.vue'

const props = defineProps<{
  overview: HostOverview | undefined
  overviewFailed: boolean
  storage: MailStorageUsage | undefined
  storageFailed: boolean
  ipCheckEnabled: boolean | null
  cpuSamples: readonly ChartSample[]
  memorySamples: readonly ChartSample[]
}>()
defineEmits<{ retryOverview: []; retryStorage: [] }>()
const { t } = useI18n()
const fmt = useFormat()
const { branding } = useBranding()

/** The host's current time in its own time zone (legacy shows the host's clock). */
const hostTime = computed(() => {
  const overview = props.overview
  if (!overview) return ''
  const date = new Date(overview.currentTime)
  const options: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'medium' }
  try {
    return new Intl.DateTimeFormat(toBcp47(fmt.locale.value), {
      ...options,
      timeZone: overview.timeZone,
    }).format(date)
  } catch {
    return new Intl.DateTimeFormat(toBcp47(fmt.locale.value), options).format(date)
  }
})

const TERM = 'text-gray-600 dark:text-gray-400'
const VALUE = 'min-w-0 wrap-anywhere text-gray-900 dark:text-white'
</script>

<template>
  <section
    class="flex flex-col gap-5 rounded-2xl border border-gray-200 bg-white p-4 sm:p-6 dark:border-gray-800 dark:bg-gray-900"
    aria-labelledby="ops-host-heading"
    data-host-section
  >
    <h2
      id="ops-host-heading"
      class="text-lg font-semibold wrap-anywhere text-gray-900 dark:text-white"
    >
      {{ branding.pageTitle }}
    </h2>
    <SectionError
      v-if="overviewFailed && !overview"
      data-overview-error
      @retry="$emit('retryOverview')"
    />
    <dl
      class="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-[minmax(8rem,auto)_minmax(0,1fr)] sm:gap-y-3"
    >
      <template v-if="overview">
        <dt :class="TERM">{{ lt('edit.hostname') }}</dt>
        <dd :class="VALUE" class="mb-2 font-semibold sm:mb-0" data-hostname>
          {{ overview.hostName }}
        </dd>
        <dt :class="TERM">{{ lt('debug.architecture') }}</dt>
        <dd :class="VALUE" class="mb-2 sm:mb-0" data-architecture>{{ overview.architecture }}</dd>
      </template>
      <template v-else-if="!overviewFailed">
        <dt
          class="h-5 w-24 rounded bg-gray-100 motion-safe:animate-pulse dark:bg-gray-800"
          aria-hidden="true"
        />
        <dd
          class="mb-2 h-5 w-40 rounded bg-gray-100 motion-safe:animate-pulse sm:mb-0 dark:bg-gray-800"
          aria-hidden="true"
        />
      </template>
      <dt :class="TERM">{{ t('operations.dashboard.ips') }}</dt>
      <dd :class="VALUE" class="mb-2 sm:mb-0">
        <PublicAddresses :ip-check-enabled="ipCheckEnabled" />
      </dd>
      <dt :class="TERM">{{ t('operations.dashboard.version') }}</dt>
      <dd :class="VALUE" class="mb-2 sm:mb-0"><VersionLine /></dd>
      <template v-if="overview">
        <dt :class="TERM">{{ lt('debug.current_time') }}</dt>
        <dd :class="VALUE" class="mb-2 tabular-nums sm:mb-0" data-host-time>
          <time :datetime="overview.currentTime">{{ hostTime }}</time>
        </dd>
        <dt :class="TERM">{{ lt('debug.timezone') }}</dt>
        <dd :class="VALUE" class="mb-2 sm:mb-0" data-time-zone>{{ overview.timeZone }}</dd>
        <dt :class="TERM">{{ lt('debug.uptime') }}</dt>
        <dd :class="VALUE" class="mb-2 sm:mb-0" data-uptime>
          {{ fmt.uptime(overview.uptimeSeconds) }}
        </dd>
      </template>
      <dt :class="TERM">{{ lt('debug.disk_usage') }}</dt>
      <dd :class="VALUE">
        <MailStorage :usage="storage" :failed="storageFailed" @retry="$emit('retryStorage')" />
      </dd>
    </dl>
    <CpuMemorySection
      v-if="overview"
      :overview="overview"
      :cpu-samples="cpuSamples"
      :memory-samples="memorySamples"
    />
  </section>
</template>
