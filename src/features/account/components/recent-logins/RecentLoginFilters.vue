<script setup lang="ts">
import ListToolbar from '@/shared/components/ListToolbar.vue'
import FilterPanel from '@/shared/components/FilterPanel.vue'

import { useI18n } from 'vue-i18n'
import { lt } from '@/i18n'
import SearchField from '@/shared/components/SearchField.vue'

import { RECENT_LOGIN_SERVICES, recentLoginPeriodLabel } from '../../recent-login-period'
import type { useRecentLoginListState } from '../../recent-login-list-state'
const props = defineProps<{ list: ReturnType<typeof useRecentLoginListState>; periods: number[] }>()
const { t } = useI18n()

const services = () => [
  ...new Set([
    ...RECENT_LOGIN_SERVICES,
    ...(props.list.state.value.filters.service ? [props.list.state.value.filters.service] : []),
  ]),
]
</script>
<template>
  <ListToolbar
    ><template #select><slot name="select" /></template
    ><template #filters
      ><FilterPanel
        id="account-components-recent-logins-RecentLoginFilters"
        :active-count="list.activeFilters.value.filter((item) => item !== 'q').length"
        immediate
        ><label class="flex min-h-11 flex-col gap-1 text-sm"
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
            @change="
              list.setFilter('service', ($event.target as HTMLSelectElement).value || undefined)
            "
          >
            <option value="">{{ t('lists.filters.all') }}</option>
            <option v-for="service in services()" :key="service" :value="service">
              {{ service }}
            </option>
          </select>
        </label></FilterPanel
      ></template
    ><template #search
      ><SearchField
        id="recent-login-search"
        :model-value="list.state.value.filters.q ?? ''"
        :label="lt('datatables.search')"
        @search="list.setFilter('q', $event || undefined, { typing: true })" /></template
  ></ListToolbar>
</template>
