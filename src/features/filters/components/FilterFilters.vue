<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { lt } from '@/i18n'
import MailboxSearchPicker from '@/shared/components/MailboxSearchPicker.vue'
import SearchField from '@/shared/components/SearchField.vue'
import { buttonVariants } from '@/shared/ui/button'
import type { useFilterListState, FilterSort } from '../list-state'
defineProps<{ list: ReturnType<typeof useFilterListState>; mailboxContext: boolean }>()
const { t } = useI18n()
const sorts = ['id', 'mailbox', 'description', 'kind', 'active', 'createdAt', 'modifiedAt'] as const
const label = (sort: string) =>
  sort === 'id'
    ? t('lists.id')
    : lt(
        sort === 'mailbox'
          ? 'mailbox.owner'
          : sort === 'description'
            ? 'mailbox.description'
            : sort === 'kind'
              ? 'add.sieve_type'
              : sort === 'active'
                ? 'mailbox.active'
                : sort === 'createdAt'
                  ? 'mailbox.created_on'
                  : 'mailbox.last_modified',
      )
</script>
<template>
  <div class="grid min-w-0 gap-3 md:grid-cols-2">
    <SearchField
      id="filter-search"
      :model-value="list.state.value.filters.q ?? ''"
      :label="lt('datatables.search')"
      @search="list.setFilter('q', $event || undefined, { typing: true })"
    />
    <MailboxSearchPicker
      v-if="!mailboxContext"
      id="filter-owner-search"
      :model-value="list.state.value.filters.mailbox ?? null"
      :label="lt('mailbox.owner')"
      @update:model-value="
        list.setFilter('mailbox', typeof $event === 'string' ? $event : undefined)
      "
    />
  </div>
  <div class="flex flex-wrap items-end gap-3">
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
            (($event.target as HTMLSelectElement).value || undefined) as 'yes' | 'no' | undefined,
          )
        "
      >
        <option value="">{{ t('lists.filters.all') }}</option>
        <option value="yes">{{ t('lists.filters.yes') }}</option>
        <option value="no">{{ t('lists.filters.no') }}</option>
      </select></label
    >
    <label class="flex min-h-11 flex-col gap-1 text-sm"
      >{{ t('lists.sort.label')
      }}<select
        class="form-control"
        :value="list.state.value.sort"
        @change="list.setSort(($event.target as HTMLSelectElement).value as FilterSort)"
      >
        <option v-for="sort in sorts" :key="sort" :value="sort">{{ label(sort) }}</option>
      </select></label
    >
    <button
      type="button"
      :class="buttonVariants({ variant: 'outline' })"
      @click="
        list.setSort(
          list.state.value.sort ?? 'id',
          list.state.value.order === 'asc' ? 'desc' : 'asc',
        )
      "
    >
      {{ t(list.state.value.order === 'asc' ? 'lists.sort.asc' : 'lists.sort.desc') }}
    </button>
  </div>
</template>
