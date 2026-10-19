<script setup lang="ts">
// The mailbox list's filters (FR-010), in place of legacy's DataTables search alone: domains
// (searched by the server), statuses, tags (with the tags in use as suggestions) and, when the
// server has an identity provider, the authentication sources; below md also the sort, because the
// table headers are not shown there. Labels are legacy's keys. The toggle names the number of
// active filters; the parent shows them as removable chips.
import { computed, ref } from 'vue'

import { mailboxStatusValues, type MailboxAuthSource, type MailboxStatus } from '@/api'
import { lt, text } from '@/i18n'
import DomainPicker, { type DomainPickerOption } from '@/shared/components/DomainPicker.vue'
import TagSetInput from '@/shared/components/TagSetInput.vue'
import type { SortOrder } from '@/shared/composables/useListState'
import { FilterIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'

import { domainPickerSource } from '../../api'
import { useMailboxTagSuggestions } from '../../composables/useMailboxTagSuggestions'
import { useMailboxFieldDisplay } from '../../field-display'
import { statusLabelKey, type MailboxSort } from '../../labels'
import type { MailboxListFilters } from '../../list-state'
import MailboxSortControl from './MailboxSortControl.vue'

const props = withDefaults(
  defineProps<{
    filters: MailboxListFilters
    activeCount: number
    sources: readonly MailboxAuthSource[]
    labels: Readonly<Record<string, string>>
    tagMaxLength?: number
    sort?: MailboxSort
    order?: SortOrder
    showSort?: boolean
  }>(),
  { tagMaxLength: 255, sort: 'address', order: 'asc', showSort: false },
)
const emit = defineEmits<{
  update: [change: Partial<MailboxListFilters>]
  sort: [sort: MailboxSort, order: SortOrder]
  pick: [option: DomainPickerOption]
}>()
const display = useMailboxFieldDisplay()
const tags = useMailboxTagSuggestions()
const open = ref(props.activeCount > 0)
const domainSources = [domainPickerSource()]

const title = computed(() =>
  props.activeCount > 0 ? `${lt('mailbox.filters')} (${props.activeCount})` : lt('mailbox.filters'),
)

function toggleStatus(value: MailboxStatus, checked: boolean) {
  const current = props.filters.status
  emit('update', {
    status: checked ? [...current, value] : current.filter((item) => item !== value),
  })
}

function toggleSource(value: MailboxAuthSource, checked: boolean) {
  const current = props.filters.source
  emit('update', {
    source: checked ? [...current, value] : current.filter((item) => item !== value),
  })
}
</script>

<template>
  <div class="flex min-w-0 flex-col gap-3">
    <button
      type="button"
      :class="
        buttonVariants({ variant: activeCount > 0 ? 'default' : 'outline', class: 'self-start' })
      "
      :aria-expanded="open ? 'true' : 'false'"
      aria-controls="mailbox-filters"
      @click="open = !open"
    >
      <FilterIcon />
      {{ title }}
    </button>
    <div
      v-show="open"
      id="mailbox-filters"
      data-filter-panel
      class="grid min-w-0 grid-cols-1 gap-4 rounded-2xl border border-gray-200 bg-white p-4 md:grid-cols-2 xl:grid-cols-4 dark:border-gray-800 dark:bg-gray-900"
    >
      <MailboxSortControl
        v-if="showSort"
        class="md:col-span-2 xl:col-span-4"
        :sort="sort"
        :order="order"
        @change="(nextSort, nextOrder) => emit('sort', nextSort, nextOrder)"
      />
      <DomainPicker
        id="mailbox-filter-domain"
        :label="lt('mailbox.domain')"
        :placeholder="lt('mailbox.all_domains')"
        :sources="domainSources"
        :model-value="filters.domain"
        :labels="labels"
        multiple
        @pick="emit('pick', $event)"
        @update:model-value="emit('update', { domain: ($event as string[] | null) ?? [] })"
      />
      <fieldset class="flex min-w-0 flex-col gap-1.5">
        <legend class="mb-1 text-sm font-medium text-gray-800 dark:text-gray-200">
          {{ lt('mailbox.status') }}
        </legend>
        <label
          v-for="status in mailboxStatusValues"
          :key="status"
          class="inline-flex min-h-11 items-center gap-3 text-gray-800 dark:text-gray-200"
        >
          <input
            type="checkbox"
            class="size-5 shrink-0 accent-brand-500"
            :data-status-filter="status"
            :checked="filters.status.includes(status)"
            @change="toggleStatus(status, ($event.target as HTMLInputElement).checked)"
          />
          <span class="min-w-0">{{ text(statusLabelKey(status)) }}</span>
        </label>
      </fieldset>
      <TagSetInput
        id="mailbox-filter-tag"
        :label="lt('add.tags')"
        :model-value="filters.tag"
        :max-length="tagMaxLength"
        :suggestions="tags.suggestions.value"
        :suggestions-state="tags.state.value"
        @search="tags.search"
        @update:model-value="emit('update', { tag: $event })"
      />
      <fieldset v-if="sources.length > 1" class="flex min-w-0 flex-col gap-1.5">
        <legend class="mb-1 text-sm font-medium text-gray-800 dark:text-gray-200">
          {{ lt('mailbox.iam') }}
        </legend>
        <label
          v-for="source in sources"
          :key="source"
          class="inline-flex min-h-11 items-center gap-3 text-gray-800 dark:text-gray-200"
        >
          <input
            type="checkbox"
            class="size-5 shrink-0 accent-brand-500"
            :data-source-filter="source"
            :checked="filters.source.includes(source)"
            @change="toggleSource(source, ($event.target as HTMLInputElement).checked)"
          />
          <span class="min-w-0">{{ display.source(source) }}</span>
        </label>
      </fieldset>
    </div>
  </div>
</template>
