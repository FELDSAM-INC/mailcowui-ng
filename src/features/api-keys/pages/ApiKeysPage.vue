<script setup lang="ts">
// The API keys of the server (FR-063, FR-064, FR-069): filters, sort and page in the address, cards
// below md and a table from md up, the loading, empty and error states, and the link to the API
// documentation.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { lt } from '@/i18n'
import ListState from '@/shared/components/ListState.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import PaginationBar from '@/shared/components/PaginationBar.vue'
import { useListState, type PageSize } from '@/shared/composables/useListState'
import { useMediaQuery } from '@/shared/composables/useMediaQuery'
import { ExternalLinkIcon, KeyIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'

import { queryProblem, useApiKeys } from '../api'
import ApiKeyFilters from '../components/ApiKeyFilters.vue'
import ApiKeyList from '../components/ApiKeyList.vue'
import { apiKeyListSchema, toApiKeyListParams, type ApiKeySort } from '../list-state'

const { t } = useI18n()
const list = useListState(apiKeyListSchema)
const params = computed(() => toApiKeyListParams(list.state.value))
const query = useApiKeys(params)
const wide = useMediaQuery('(min-width: 768px)')

const keys = computed(() => query.data.value?.data ?? [])
const total = computed(() => query.data.value?.meta.total ?? 0)
const filtered = computed(() => list.activeFilters.value.length > 0)

function sortBy(column: ApiKeySort) {
  const { sort, order } = list.state.value
  if (sort === column) void list.setSort(column, order === 'asc' ? 'desc' : 'asc')
  else void list.setSort(column)
}

function clearFilters() {
  void list.setFilters({ owner: undefined, status: undefined, access: undefined })
}
</script>

<template>
  <section class="mx-auto flex w-full max-w-7xl flex-col gap-6">
    <PageHeader :title="t('apiKeys.title')" :description="t('apiKeys.intro')">
      <template #actions>
        <RouterLink :to="{ name: 'api-key-create' }" :class="buttonVariants({})">
          {{ t('apiKeys.create.action') }}
        </RouterLink>
        <RouterLink
          :to="{ name: 'system-settings-cors' }"
          :class="buttonVariants({ variant: 'outline' })"
          >{{ lt('admin.cors_settings') }}</RouterLink
        >
        <a
          href="/api/v2/docs"
          target="_blank"
          rel="noopener noreferrer"
          :class="buttonVariants({ variant: 'outline' })"
        >
          <ExternalLinkIcon class="size-4" />
          {{ t('apiKeys.docs') }}
          <span class="sr-only">{{ t('common.opensInNewTab') }}</span>
        </a>
      </template>
    </PageHeader>

    <ApiKeyFilters :list="list" :show-sort="!wide" />

    <ListState
      :loading="query.isPending.value"
      :empty="keys.length === 0"
      :problem="queryProblem(query.error.value)"
      @retry="query.refetch()"
    >
      <template #empty>
        <div v-if="filtered" class="flex flex-col items-center gap-3">
          <p>{{ t('apiKeys.empty.filtered') }}</p>
          <button
            type="button"
            :class="buttonVariants({ variant: 'outline' })"
            @click="clearFilters"
          >
            {{ t('apiKeys.filters.clear') }}
          </button>
        </div>
        <div v-else data-empty class="mx-auto flex max-w-xl flex-col items-center gap-3">
          <KeyIcon class="size-8 text-gray-500 dark:text-gray-400" />
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
            {{ t('apiKeys.empty.title') }}
          </h2>
          <p>{{ t('apiKeys.empty.body') }}</p>
          <RouterLink :to="{ name: 'api-key-create' }" :class="buttonVariants({})">
            {{ t('apiKeys.create.action') }}
          </RouterLink>
        </div>
      </template>
      <div class="flex flex-col gap-4">
        <ApiKeyList
          :keys="keys"
          :sort="list.state.value.sort ?? 'createdAt'"
          :order="list.state.value.order ?? 'desc'"
          @sort="sortBy"
        />
        <PaginationBar
          :total="total"
          :page="list.state.value.page"
          :size="list.state.value.size"
          @update:page="list.setPage"
          @update:size="(size) => list.setSize(size as PageSize)"
        />
      </div>
    </ListState>
  </section>
</template>
