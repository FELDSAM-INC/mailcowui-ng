<script setup lang="ts">
// The authentication audit log (FR-071–FR-074, data-model §5): records newest first, 25 per page,
// with filters in the page address, removable filter chips, loading, empty and error states, and
// the number of matching records announced after a change of filters.
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { ApiProblem, isApiProblem } from '@/api'
import { lt } from '@/i18n'
import ListState from '@/shared/components/ListState.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import PaginationBar from '@/shared/components/PaginationBar.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import { PAGE_SIZES, useListState, type PageSize } from '@/shared/composables/useListState'
import { buttonVariants } from '@/shared/ui/button'

import { useAuditEvents } from '../api'
import ActiveFilterChips from '../components/ActiveFilterChips.vue'
import AuditEventList from '../components/AuditEventList.vue'
import AuditFilters from '../components/AuditFilters.vue'
import { auditListSchema, type AuditFilterValues } from '../list-state'

const { t } = useI18n()
const list = useListState(auditListSchema)
const query = useAuditEvents(() => list.state.value)
const filters = computed(() => list.state.value.filters)
const events = computed(() => query.data.value?.data ?? [])
const total = computed(() => query.data.value?.meta.total ?? 0)
const filtered = computed(() => {
  const value = filters.value
  return !!(
    value.range ||
    value.event.length ||
    value.outcome ||
    value.actor ||
    value.address ||
    value.targetType ||
    value.targetId
  )
})
const problem = computed(() => {
  const error = query.error.value
  if (!error) return null
  return isApiProblem(error) ? error : ApiProblem.fromParts({ kind: 'network', cause: error })
})

const NO_FILTERS: Partial<AuditFilterValues> = {
  range: undefined,
  from: undefined,
  to: undefined,
  event: [],
  outcome: undefined,
  actor: undefined,
  address: undefined,
  targetType: undefined,
  targetId: undefined,
}

/** After a change of filters, the next result is announced (FR-078). */
const announceNext = ref(false)

function setSize(size: number) {
  if ((PAGE_SIZES as readonly number[]).includes(size)) void list.setSize(size as PageSize)
}

function change(values: Partial<AuditFilterValues>) {
  announceNext.value = true
  void list.setFilters(values)
}

watch(
  () => [query.data.value, query.isPlaceholderData.value] as const,
  ([data, placeholder]) => {
    if (!announceNext.value || !data || placeholder) return
    announceNext.value = false
    announce(t('auditLog.resultCount', { total: data.meta.total }))
  },
)
</script>

<template>
  <section class="mx-auto flex w-full max-w-6xl flex-col gap-6">
    <PageHeader :title="t('auditLog.title')" :description="t('auditLog.description')" />
    <AuditFilters
      :filters="filters"
      :problem="problem"
      @apply="change"
      @clear="change(NO_FILTERS)"
    />
    <ActiveFilterChips :filters="filters" @remove="change" @clear="change(NO_FILTERS)" />
    <div class="flex flex-col gap-4">
      <h2 class="sr-only">{{ t('auditLog.records') }}</h2>
      <ListState
        :loading="query.isPending.value"
        :empty="events.length === 0"
        :problem="problem"
        @retry="query.refetch()"
      >
        <template #empty>
          <div v-if="filtered" class="flex flex-col items-center gap-3">
            <p>{{ lt('datatables.zeroRecords') }}</p>
            <button
              type="button"
              :class="buttonVariants({ variant: 'outline' })"
              @click="change(NO_FILTERS)"
            >
              {{ t('auditLog.filters.clear') }}
            </button>
          </div>
          <p v-else>{{ lt('datatables.emptyTable') }}</p>
        </template>
        <AuditEventList :events="events" />
      </ListState>
      <PaginationBar
        v-if="total > 0"
        :total="total"
        :page="list.state.value.page"
        :size="list.state.value.size"
        :page-sizes="list.pageSizes"
        @update:page="list.setPage"
        @update:size="setSize"
      />
    </div>
  </section>
</template>
