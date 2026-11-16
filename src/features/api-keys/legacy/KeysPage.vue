<script setup lang="ts">
import { keepPreviousData, useQuery } from '@tanstack/vue-query'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { problemOf } from '@/api'
import { lt } from '@/i18n'
import PageHeader from '@/shared/components/PageHeader.vue'
import ListToolbar from '@/shared/components/ListToolbar.vue'
import ListState from '@/shared/components/ListState.vue'
import SearchField from '@/shared/components/SearchField.vue'
import PaginationBar from '@/shared/components/PaginationBar.vue'
import { useDataList } from '@/shared/composables/useDataList'
import { useListQueryState } from '@/shared/composables/useListQueryState'
import { useListState, text, type PageSize } from '@/shared/composables/useListState'
import { buttonVariants } from '@/shared/ui/button'
import { listOptions } from './api'
import KeyList from './KeyList.vue'
const { t } = useI18n()
const sorts = ['description', 'accessLevel', 'active', 'service', 'id'] as const
const list = useListState({
  filters: { q: text({ maxLength: 255 }) },
  sort: { values: sorts, default: 'description', defaultOrder: () => 'asc' },
})
const query = useQuery(
  computed(() => ({
    ...listOptions({
      q: list.state.value.filters.q || undefined,
      sort: list.state.value.sort ?? 'description',
      order: list.state.value.order ?? 'asc',
      limit: list.state.value.size,
      offset: (list.state.value.page - 1) * list.state.value.size,
    }),
    placeholderData: keepPreviousData,
  })),
)
const states = useListQueryState(query, () => !!list.state.value.filters.q)
useDataList(
  'legacy-api-keys',
  () => ({
    key: list.state.value.sort ?? 'description',
    order: list.state.value.order ?? 'asc',
    change: (key, order) => {
      if (sorts.includes(key as (typeof sorts)[number]))
        void list.setSort(key as (typeof sorts)[number], order)
    },
  }),
  () => ({ pending: query.isFetching.value, run: () => query.refetch() }),
)
</script>
<template>
  <section class="flex w-full min-w-0 flex-col gap-4">
    <PageHeader :title="t('legacyKeys.title')" :description="t('legacyKeys.intro')"
      ><template #actions
        ><RouterLink :to="{ name: 'legacy-api-key-create' }" :class="buttonVariants({})">{{
          t('legacyKeys.create')
        }}</RouterLink></template
      ></PageHeader
    ><ListToolbar
      ><template #search
        ><SearchField
          id="legacy-key-search"
          :label="lt('datatables.search')"
          :model-value="list.state.value.filters.q ?? ''"
          @search="
            list.setFilter('q', $event || undefined, { typing: true })
          " /></template></ListToolbar
    ><ListState
      :loading="states.initialLoading.value"
      :empty="states.empty.value"
      :failed="states.loadFailed.value"
      :refresh-failed="states.refreshFailed.value"
      :no-matches="states.noMatches.value"
      :problem="problemOf(query.error.value)"
      @retry="query.refetch()"
      @clear="list.setFilter('q', undefined)"
      ><KeyList :entries="query.data.value?.data ?? []" /><PaginationBar
        :total="states.total.value"
        :page="list.state.value.page"
        :size="list.state.value.size"
        @update:page="list.setPage"
        @update:size="list.setSize($event as PageSize)"
    /></ListState>
  </section>
</template>
