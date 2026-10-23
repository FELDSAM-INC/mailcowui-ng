<script setup lang="ts">
import ListToolbar from '@/shared/components/ListToolbar.vue'
import FilterPanel from '@/shared/components/FilterPanel.vue'

import { useI18n } from 'vue-i18n'
import { lt } from '@/i18n'
import MailboxSearchPicker from '@/shared/components/MailboxSearchPicker.vue'
import SearchField from '@/shared/components/SearchField.vue'

import type { useFilterListState } from '../list-state'
defineProps<{ list: ReturnType<typeof useFilterListState>; mailboxContext: boolean }>()
const { t } = useI18n()
</script>
<template>
  <ListToolbar
    ><template #select><slot name="select" /></template
    ><template #filters
      ><FilterPanel
        id="filters-components-FilterFilters"
        :active-count="list.activeFilters.value.filter((item) => item !== 'q').length"
        immediate
        ><MailboxSearchPicker
          v-if="!mailboxContext"
          id="filter-owner-search"
          :model-value="list.state.value.filters.mailbox ?? null"
          :label="lt('mailbox.owner')"
          @update:model-value="
            list.setFilter('mailbox', typeof $event === 'string' ? $event : undefined)
          "
        />
        <label class="flex min-h-11 flex-col gap-1 text-sm"
          >{{ lt('add.sieve_type')
          }}<select
            class="form-control"
            :value="list.state.value.filters.kind ?? ''"
            @change="
              list.setFilter(
                'kind',
                (($event.target as HTMLSelectElement).value || undefined) as
                  'prefilter' | 'postfilter' | undefined,
              )
            "
          >
            <option value="">{{ t('lists.filters.all') }}</option>
            <option value="prefilter">{{ t('filters.kind.prefilter') }}</option>
            <option value="postfilter">{{ t('filters.kind.postfilter') }}</option>
          </select></label
        >
        <label class="flex min-h-11 flex-col gap-1 text-sm"
          >{{ lt('mailbox.active')
          }}<select
            class="form-control"
            :value="list.state.value.filters.active ?? ''"
            @change="
              list.setFilter(
                'active',
                (($event.target as HTMLSelectElement).value || undefined) as
                  'yes' | 'no' | undefined,
              )
            "
          >
            <option value="">{{ t('lists.filters.all') }}</option>
            <option value="yes">{{ t('lists.filters.yes') }}</option>
            <option value="no">{{ t('lists.filters.no') }}</option>
          </select></label
        ></FilterPanel
      ></template
    ><template #search
      ><SearchField
        id="filter-search"
        :model-value="list.state.value.filters.q ?? ''"
        :label="lt('datatables.search')"
        @search="list.setFilter('q', $event || undefined, { typing: true })" /></template
  ></ListToolbar>
</template>
