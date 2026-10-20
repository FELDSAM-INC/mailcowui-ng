<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { lt } from '@/i18n'
import SearchField from '@/shared/components/SearchField.vue'
import { buttonVariants } from '@/shared/ui/button'
import { RECENT_LOGIN_SERVICES, recentLoginPeriodLabel } from '../../recent-login-period'
import type { useRecentLoginListState, RecentLoginSort } from '../../recent-login-list-state'
const props = defineProps<{ list: ReturnType<typeof useRecentLoginListState>; periods: number[] }>()
const { t } = useI18n()
const sorts = ['lastSeenAt', 'service', 'clientAddress'] as const
const label = (sort: RecentLoginSort) =>
  sort === 'lastSeenAt'
    ? lt('admin.time')
    : sort === 'service'
      ? lt('admin.service')
      : t('auditLog.columns.address')
const services = () => [
  ...new Set([
    ...RECENT_LOGIN_SERVICES,
    ...(props.list.state.value.filters.service ? [props.list.state.value.filters.service] : []),
  ]),
]
</script>
<template>
  <SearchField
    id="recent-login-search"
    :model-value="list.state.value.filters.q ?? ''"
    :label="lt('datatables.search')"
    @search="list.setFilter('q', $event || undefined, { typing: true })"
  />
  <div class="flex flex-wrap items-end gap-3">
    <label class="flex min-h-11 flex-col gap-1 text-sm"
      >{{ lt('user.login_history') }}
      <select
        class="form-control"
        :value="list.state.value.filters.days"
        @change="list.setFilter('days', Number(($event.target as HTMLSelectElement).value))"
      >
        <option v-for="days in periods" :key="days" :value="days">
          {{ recentLoginPeriodLabel(days) }}
        </option>
      </select>
    </label>
    <label class="flex min-h-11 flex-col gap-1 text-sm"
      >{{ lt('admin.service') }}
      <select
        class="form-control"
        :value="list.state.value.filters.service ?? ''"
        @change="list.setFilter('service', ($event.target as HTMLSelectElement).value || undefined)"
      >
        <option value="">{{ t('lists.filters.all') }}</option>
        <option v-for="service in services()" :key="service" :value="service">{{ service }}</option>
      </select>
    </label>
    <label class="flex min-h-11 flex-col gap-1 text-sm"
      >{{ t('lists.sort.label') }}
      <select
        class="form-control"
        :value="list.state.value.sort"
        @change="list.setSort(($event.target as HTMLSelectElement).value as RecentLoginSort)"
      >
        <option v-for="sort in sorts" :key="sort" :value="sort">{{ label(sort) }}</option>
      </select>
    </label>
    <button
      type="button"
      :class="buttonVariants({ variant: 'outline' })"
      @click="
        list.setSort(
          list.state.value.sort ?? 'lastSeenAt',
          list.state.value.order === 'asc' ? 'desc' : 'asc',
        )
      "
    >
      {{ t(list.state.value.order === 'asc' ? 'lists.sort.asc' : 'lists.sort.desc') }}
    </button>
  </div>
</template>
