<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { computed, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { problemOf } from '@/api'
import { lt } from '@/i18n'
import { useFormat } from '@/i18n/format'
import PageHeader from '@/shared/components/PageHeader.vue'
import ListState from '@/shared/components/ListState.vue'
import PaginationBar from '@/shared/components/PaginationBar.vue'
import SearchField from '@/shared/components/SearchField.vue'
import PlainText from '@/shared/components/PlainText.vue'
import LegacyText from '@/shared/components/LegacyText.vue'
import { text, useListState, type PageSize } from '@/shared/composables/useListState'
import { announce } from '@/shared/composables/useAnnouncer'
import { regexMapsOptions } from '../../api/regex-maps'
const { t } = useI18n()
const format = useFormat()
const list = useListState({
  filters: { q: text({ maxLength: 255 }) },
  sort: { values: ['name'] as const, default: 'name', defaultOrder: () => 'asc' as const },
})
const { state } = list
const params = computed(() => ({
  q: state.value.filters.q,
  limit: state.value.size,
  offset: (state.value.page - 1) * state.value.size,
}))
const query = useQuery(computed(() => regexMapsOptions(params.value)))
const entries = computed(() => query.data.value?.data ?? [])
watch(
  () => query.data.value,
  (data) => {
    if (data)
      announce(t('systemSettings.filterMaps.count', { count: format.number(data.meta.total) }))
  },
)
</script>
<template>
  <section class="min-w-0 space-y-4">
    <PageHeader :title="lt('admin.rspamd_global_filters')" />
    <LegacyText k="admin.rspamd_global_filters_info" as="p" />
    <SearchField
      id="map-search"
      :label="t('systemSettings.filterMaps.search')"
      :model-value="state.filters.q ?? ''"
      @search="list.setFilter('q', $event || undefined, { typing: true })"
    />
    <ListState
      :loading="query.isPending.value"
      :empty="entries.length === 0"
      :problem="problemOf(query.error.value)"
      @retry="query.refetch()"
    >
      <ul class="grid min-w-0 gap-3 md:grid-cols-2">
        <li v-for="map in entries" :key="map.id" class="min-w-0">
          <RouterLink
            :to="{ name: 'system-settings-filter-map', params: { mapId: map.id } }"
            class="flex min-h-11 h-full flex-col gap-2 rounded-xl border border-gray-200 p-4 text-gray-900 focus-visible:outline-2 focus-visible:outline-brand-500 dark:border-gray-700 dark:text-white"
          >
            <PlainText :value="map.name" class="font-semibold" />
            <PlainText :value="map.id" class="font-mono text-sm" />
            <span class="text-sm text-gray-600 dark:text-gray-400">{{
              map.available
                ? format.bytes(map.sizeBytes)
                : t('systemSettings.filterMaps.unavailable')
            }}</span>
          </RouterLink>
        </li>
      </ul>
    </ListState>
    <PaginationBar
      v-if="query.data.value"
      :total="query.data.value.meta.total"
      :page="state.page"
      :size="state.size"
      @update:page="list.setPage"
      @update:size="list.setSize($event as PageSize)"
    />
  </section>
</template>
