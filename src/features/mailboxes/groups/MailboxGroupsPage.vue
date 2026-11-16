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
import { buttonVariants } from '@/shared/ui/button'
import { groupListOptions } from './api'
import { useGroupListState, groupSorts } from './list-state'
import GroupList from './GroupList.vue'
import GroupWarnings from './GroupWarnings.vue'
import { takeDeletionWarnings } from './flash'
const deletionWarnings = takeDeletionWarnings()
const { t } = useI18n()
const list = useGroupListState()
const query = useQuery(
  computed(() => ({ ...groupListOptions(list.params.value), placeholderData: keepPreviousData })),
)
const states = useListQueryState(query, () => !!list.state.value.filters.q)
useDataList(
  'mailbox-groups',
  () => ({
    key: list.state.value.sort ?? 'name',
    order: list.state.value.order ?? 'asc',
    change: (key, order) => {
      if (groupSorts.includes(key as (typeof groupSorts)[number]))
        void list.setSort(key as (typeof groupSorts)[number], order)
    },
  }),
  () => ({ pending: query.isFetching.value, run: () => query.refetch() }),
)
</script>
<template>
  <section class="flex w-full min-w-0 flex-col gap-4">
    <PageHeader :title="t('mailboxGroups.title')"
      ><template #actions
        ><RouterLink :to="{ name: 'mailbox-group-create' }" :class="buttonVariants({})">{{
          t('mailboxGroups.create')
        }}</RouterLink></template
      ></PageHeader
    >
    <GroupWarnings :warnings="deletionWarnings" />
    <ListToolbar
      ><template #search
        ><SearchField
          id="group-search"
          :label="lt('datatables.search')"
          :model-value="list.state.value.filters.q ?? ''"
          @search="list.setFilter('q', $event || undefined, { typing: true })" /></template
    ></ListToolbar>
    <ListState
      :loading="states.initialLoading.value"
      :empty="states.empty.value"
      :failed="states.loadFailed.value"
      :refresh-failed="states.refreshFailed.value"
      :no-matches="states.noMatches.value"
      :problem="problemOf(query.error.value)"
      @retry="query.refetch()"
      @clear="list.setFilter('q', undefined)"
    >
      <GroupList :groups="query.data.value?.data ?? []" />
      <PaginationBar
        :total="states.total.value"
        :page="list.state.value.page"
        :size="list.state.value.size"
        @update:page="list.setPage"
        @update:size="(size) => list.setSize(size as 25 | 50 | 100)"
      />
    </ListState>
  </section>
</template>
