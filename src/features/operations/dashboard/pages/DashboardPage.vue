<script setup lang="ts">
// The dashboard (US1, US2, US7; legacy "System & Containers" tab): the live-update bar, the host
// card and one card per container. The live reads poll at the capabilities' interval while the page
// is visible, running and interacted with (research R5); the version and update status are read
// once per visit. A container's own address (`expand`) opens its card and focuses it; collapsing
// it returns to the dashboard's address; a name the installation does not have is "not found".
import { useIsFetching } from '@tanstack/vue-query'
import { computed, nextTick, provide, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useSessionStore } from '@/app/session/store'
import NotFoundPage from '@/app/states/NotFoundPage.vue'
import { lt } from '@/i18n'
import PageHeader from '@/shared/components/PageHeader.vue'

import { useMonitoringCapabilities } from '../../capabilities'
import LiveUpdatesBar from '../../live/components/LiveUpdatesBar.vue'
import SectionError from '../../live/components/SectionError.vue'
import { useLiveSeries } from '../../live/useLiveSeries'
import { useLiveUpdates } from '../../live/useLiveUpdates'
import { useContainers, useHostOverview, useMailStorage } from '../api'
import ContainerCard from '../components/ContainerCard.vue'
import HostSection from '../components/HostSection.vue'
import { useStoppedAnnouncer } from '../composables/useStoppedAnnouncer'
import { LIVE_CONTEXT } from '../live-context'
import { operationsKeys } from '../../query-keys'

const props = defineProps<{ expand?: string }>()
const route = useRoute()
const router = useRouter()
const session = useSessionStore()

const capabilities = useMonitoringCapabilities()
const live = useLiveUpdates({
  capabilities: () => capabilities.capabilities.value,
  unavailable: () => capabilities.unavailable.value,
  idleTimeout: () => session.idleTimeout,
})
provide(LIVE_CONTEXT, { interval: (kind) => live.interval(kind) })

const host = useHostOverview(() => live.interval('host'))
const storage = useMailStorage(() => live.interval('mailStorage'))
const containers = useContainers(() => live.interval('containers'))

const cpu = useLiveSeries(1)
const memory = useLiveSeries(1)
watch(
  () => host.data.value,
  (overview) => {
    if (!overview) return
    cpu.push(overview.collectedAt, [overview.cpu.usagePercent])
    memory.push(overview.collectedAt, [overview.memory.usagePercent])
  },
  { immediate: true },
)

useStoppedAnnouncer(() => containers.data.value)

/** A refresh of a section that still shows its last values failed (FR-023). */
const failed = computed(() =>
  [host, storage, containers].some((query) => query.isError.value && query.data.value),
)
const fetchingLive = useIsFetching({ queryKey: operationsKeys.monitoring.live() })
const refreshing = computed(() => fetchingLive.value > 0)

function refresh() {
  live.noteManualRefresh()
  void live.refreshNow()
}

// Expanded cards; the addressed one opens and takes the focus once the list is shown.
const expanded = ref(new Set<string>(props.expand ? [props.expand] : []))
const list = ref<HTMLElement | null>(null)
watch(
  () => props.expand,
  (name) => {
    if (name) expanded.value = new Set([...expanded.value, name])
  },
)
watch(
  () => [props.expand, containers.data.value] as const,
  async ([name, items]) => {
    if (!name || !items?.some((item) => item.name === name)) return
    await nextTick()
    list.value
      ?.querySelector<HTMLElement>(`[data-container="${CSS.escape(name)}"] [data-expand]`)
      ?.focus()
  },
  { immediate: true },
)
const unknownContainer = computed(
  () =>
    !!props.expand &&
    !!containers.data.value &&
    !containers.data.value.some((item) => item.name === props.expand),
)

function toggle(name: string) {
  const next = new Set(expanded.value)
  if (next.has(name)) {
    next.delete(name)
    if (props.expand === name) {
      void router.replace({ name: 'operations-dashboard', query: route.query })
    }
  } else next.add(name)
  expanded.value = next
}
</script>

<template>
  <NotFoundPage
    v-if="unknownContainer"
    :back-to="{ name: 'operations-dashboard' }"
    :back-label="lt('debug.system_containers')"
  />
  <div v-else class="flex flex-col gap-6">
    <PageHeader :title="lt('debug.system_containers')" />
    <LiveUpdatesBar
      :state="live.state.value"
      :since="live.since.value"
      :failed="failed"
      :refreshing="refreshing"
      @pause="live.pause()"
      @resume="live.resume()"
      @refresh="refresh"
      @retry-capabilities="capabilities.retry()"
    />
    <HostSection
      :overview="host.data.value"
      :overview-failed="host.isError.value"
      :storage="storage.data.value"
      :storage-failed="storage.isError.value"
      :ip-check-enabled="capabilities.capabilities.value?.ipCheckEnabled ?? null"
      :cpu-samples="cpu.samples.value"
      :memory-samples="memory.samples.value"
      @retry-overview="host.refetch()"
      @retry-storage="storage.refetch()"
    />
    <section
      ref="list"
      class="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4 sm:p-6 dark:border-gray-800 dark:bg-gray-900"
      aria-labelledby="ops-containers-heading"
      data-containers
    >
      <h2 id="ops-containers-heading" class="text-lg font-semibold text-gray-900 dark:text-white">
        {{ lt('debug.containers_info') }}
      </h2>
      <SectionError
        v-if="containers.isError.value && !containers.data.value"
        @retry="containers.refetch()"
      />
      <div v-else-if="!containers.data.value" class="grid gap-3 md:grid-cols-2" aria-hidden="true">
        <div
          v-for="index in 4"
          :key="index"
          class="h-28 rounded-xl bg-gray-100 motion-safe:animate-pulse dark:bg-gray-800"
        />
      </div>
      <ul v-else class="grid gap-3 md:grid-cols-2">
        <li v-for="container in containers.data.value" :key="container.name" class="min-w-0">
          <ContainerCard
            :container="container"
            :expanded="expanded.has(container.name)"
            @toggle="toggle(container.name)"
          />
        </li>
      </ul>
    </section>
  </div>
</template>
