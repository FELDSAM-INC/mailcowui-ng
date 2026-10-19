<script setup lang="ts">
// A relayhost's usage (UI 009 FR-023; the paged form of legacy's "In use by" cell): the domains and
// mailboxes assigned to it, filtered by kind, searched by name, sorted and paged in the address,
// each linking to its domain or mailbox page.
import { keepPreviousData, useQuery } from '@tanstack/vue-query'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'

import { problemOf, type RelayhostUsageEntry } from '@/api'
import { lt } from '@/i18n'
import PageHeader from '@/shared/components/PageHeader.vue'
import PaginationBar from '@/shared/components/PaginationBar.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import type { PageSize } from '@/shared/composables/useListState'

import { relayhostUsageOptions, useRelayhost } from '../../api/relayhosts'
import EntryList from '../../components/common/EntryList.vue'
import type { EntryColumn } from '../../components/common/entry-list'
import ListToolbar from '../../components/common/ListToolbar.vue'
import { relayhostName } from '../../components/relayhosts/relayhost-columns'
import { useRelayhostUsageState } from '../../list-states/relayhost-usage'

const { t } = useI18n()
const route = useRoute()
const id = computed(() => Number(route.params.relayhostId))
const relayhost = useRelayhost(id)
const list = useRelayhostUsageState()
const state = computed(() => list.state.value)
const query = useQuery(
  computed(() => ({
    ...relayhostUsageOptions(id.value, list.params.value),
    placeholderData: keepPreviousData,
  })),
)
const entries = computed(() => query.data.value?.data ?? [])
const total = computed(() => query.data.value?.meta.total ?? 0)

const kindLabel = (kind: RelayhostUsageEntry['kind']) =>
  lt(kind === 'domain' ? 'mailbox.domain' : 'mailbox.mailbox')
const columns = computed<EntryColumn<RelayhostUsageEntry>[]>(() => [
  {
    key: 'name',
    label: lt('diagnostics.dns_records_name'),
    sort: 'name',
    text: (item) => item.name,
  },
  { key: 'kind', label: lt('mailbox.kind'), sort: 'kind', text: (item) => kindLabel(item.kind) },
])
const filters = computed(() => [
  {
    key: 'kind',
    label: lt('mailbox.kind'),
    kind: 'select' as const,
    options: [
      { value: 'domain', label: lt('mailbox.domain') },
      { value: 'mailbox', label: lt('mailbox.mailbox') },
    ],
  },
])
const sorts = computed(() => [
  { value: 'kind', label: lt('mailbox.kind') },
  { value: 'name', label: lt('diagnostics.dns_records_name') },
])
const target = (item: RelayhostUsageEntry) =>
  item.kind === 'domain'
    ? { name: 'domain-detail', params: { domain: item.name } }
    : { name: 'mailbox-detail', params: { address: item.name } }
const listState = computed(() =>
  query.isPending.value ? 'loading' : query.isError.value && !query.data.value ? 'error' : 'ready',
)
</script>

<template>
  <section class="mx-auto flex w-full max-w-5xl flex-col gap-4" :data-list-state="listState">
    <RouterLink
      :to="{ name: 'routing-relayhosts' }"
      class="inline-flex min-h-11 items-center self-start text-sm font-medium text-brand-600 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-brand-400"
    >
      <span aria-hidden="true">←&nbsp;</span>{{ lt('admin.relayhosts') }}
    </RouterLink>
    <PageHeader
      :title="lt('admin.in_use_by')"
      :description="relayhost.data.value ? relayhostName(relayhost.data.value) : undefined"
    />
    <ListToolbar
      id-prefix="relayhost-usage"
      :filters="filters"
      :sorts="sorts"
      :values="state.filters"
      :search="state.filters.q ?? ''"
      :sort="state.sort ?? 'kind'"
      :order="state.order ?? 'asc'"
      @search="(value) => list.setFilter('q', value || undefined, { typing: true })"
      @filter="
        (key, value) => list.setFilter(key as 'kind', value as 'domain' | 'mailbox' | undefined)
      "
      @sort="(sort, order) => list.setSort(sort as 'kind' | 'name', order)"
      @clear="list.clearFilters()"
    />
    <p v-if="query.isPending.value" role="status" aria-busy="true">
      {{ lt('datatables.loadingRecords') }}
    </p>
    <div v-else-if="query.isError.value && !query.data.value" class="flex flex-col gap-3">
      <p role="alert" class="font-medium text-gray-900 dark:text-white">
        {{ t('states.list.error') }}
      </p>
      <ProblemMessage :problem="problemOf(query.error.value)" retry @retry="query.refetch()" />
    </div>
    <p v-else-if="total === 0" class="text-gray-700 dark:text-gray-300">
      {{ lt(list.hasFilters.value ? 'datatables.zeroRecords' : 'datatables.emptyTable') }}
    </p>
    <template v-else>
      <EntryList
        :entries="entries"
        :columns="columns"
        :id-of="(item) => `${item.kind}:${item.name}`"
        :edit-to="target"
        :caption="lt('admin.in_use_by')"
        :actions-label="lt('admin.action')"
        :sort="state.sort ?? 'kind'"
        :order="state.order ?? 'asc'"
        @sort="(sort, order) => list.setSort(sort as 'kind' | 'name', order)"
      />
      <PaginationBar
        :total="total"
        :page="state.page"
        :size="state.size"
        @update:page="list.setPage"
        @update:size="(size) => list.setSize(size as PageSize)"
      />
    </template>
  </section>
</template>
