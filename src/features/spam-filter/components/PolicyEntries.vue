<script setup lang="ts">
import DataCardFields from '@/shared/components/DataCardFields.vue'
import DataCard from '@/shared/components/DataCard.vue'
// The entries of one list (UI 006 FR-046, legacy form map screen 5 and D16): a table from `md` up
// with legacy's columns ID, Rule (`user.spamfilter_table_rule`), Scope and the creation date the API
// adds (`user.created_on`, D17), and cards below `md`. Own entries come first and can be selected;
// the entries shown read-only (a mailbox's domain entries, a domain's mailbox entries) are marked
// with legacy's `user.spamfilter_table_domain_policy`, and their owner links to its page when the
// caller may open it. Patterns and owners are API strings, shown through `PlainText`.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, type RouteLocationRaw } from 'vue-router'

import type { SpamPolicyEntry, SpamPolicyList } from '@/api'
import { lt, type LegacyKey } from '@/i18n'
import DateTime from '@/shared/components/DateTime.vue'
import PlainText from '@/shared/components/PlainText.vue'
import SelectCheckbox from '@/shared/components/SelectCheckbox.vue'
import { useMediaQuery } from '@/shared/composables/useMediaQuery'
import type { SortOrder } from '@/shared/composables/useListState'

import type { PolicySort } from '../lists-state'

const props = defineProps<{
  list: SpamPolicyList
  entries: readonly SpamPolicyEntry[]
  sort: PolicySort
  order: SortOrder
  /** Own entries can be selected for removal. */
  selectable: boolean
  isSelected: (id: string) => boolean
  canSelect: (id: string) => boolean
  /** The page of an entry's owner, or null when the caller may not open it. */
  ownerLink: (entry: SpamPolicyEntry) => RouteLocationRaw | null
  limitId?: string
}>()
const emit = defineEmits<{
  toggle: [id: string]
  toggleAll: [checked: boolean]
  sort: [sort: PolicySort, order: SortOrder]
}>()
const { t } = useI18n()
const wide = useMediaQuery('(min-width: 768px)')

const CAPTION: Record<SpamPolicyList, LegacyKey> = {
  allow: 'user.spamfilter_wl',
  block: 'user.spamfilter_bl',
}
const ownIds = computed(() =>
  props.entries.filter((entry) => entry.own).map((entry) => String(entry.id)),
)
const allSelected = computed(
  () =>
    ownIds.value.length > 0 &&
    ownIds.value.every((id) => props.isSelected(id) || !props.canSelect(id)),
)
const showSelect = computed(() => props.selectable && ownIds.value.length > 0)

function ariaSort(key: PolicySort) {
  if (key !== props.sort) return 'none'
  return props.order === 'asc' ? 'ascending' : 'descending'
}
function sortBy(key: PolicySort) {
  emit('sort', key, key === props.sort && props.order === 'asc' ? 'desc' : 'asc')
}
const SORTABLE: { key: PolicySort; label: LegacyKey }[] = [
  { key: 'pattern', label: 'user.spamfilter_table_rule' },
  { key: 'createdAt', label: 'user.created_on' },
]
const LINK =
  'inline-flex min-h-11 max-w-full items-center break-all text-accent-text bg-white dark:bg-gray-900 underline underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500 '
</script>

<template>
  <div v-if="wide" class="table-frame">
    <table class="data-table w-full table-fixed text-sm" :data-entries="list">
      <caption class="sr-only">
        {{
          lt(CAPTION[list])
        }}
      </caption>
      <thead class="border-b border-gray-200 dark:border-gray-800">
        <tr>
          <th v-if="showSelect" scope="col" class="w-14 px-2 py-2">
            <SelectCheckbox
              :label="lt('mailbox.toggle_all')"
              :checked="allSelected"
              @change="emit('toggleAll', $event)"
            />
          </th>
          <th scope="col" class="w-16 px-2 py-2 text-start align-bottom">
            {{ t('lists.id') }}
          </th>
          <th
            scope="col"
            class="px-2 py-2 text-start align-bottom"
            :aria-sort="ariaSort('pattern')"
          >
            <button
              type="button"
              class="inline-flex min-h-11 items-center gap-1 text-start break-words hover:text-gray-900 dark:hover:text-white"
              @click="sortBy('pattern')"
            >
              {{ lt(SORTABLE[0]!.label) }}
              <span aria-hidden="true">{{
                sort === 'pattern' ? (order === 'asc' ? '▲' : '▼') : ''
              }}</span>
            </button>
          </th>
          <th scope="col" class="px-2 py-2 text-start align-bottom">
            {{ t('spamFilter.lists.scope') }}
          </th>
          <th
            scope="col"
            class="w-32 px-2 py-2 text-start align-bottom"
            :aria-sort="ariaSort('createdAt')"
          >
            <button
              type="button"
              class="inline-flex min-h-11 items-center gap-1 text-start break-words hover:text-gray-900 dark:hover:text-white"
              @click="sortBy('createdAt')"
            >
              {{ lt(SORTABLE[1]!.label) }}
              <span aria-hidden="true">{{
                sort === 'createdAt' ? (order === 'asc' ? '▲' : '▼') : ''
              }}</span>
            </button>
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-200 dark:divide-gray-800">
        <tr
          v-for="entry in entries"
          :key="`${entry.own ? 'own' : 'inherited'}-${entry.id}`"
          :data-entry="entry.id"
          :data-own="entry.own ? 'true' : 'false'"
          class="align-top"
        >
          <td v-if="showSelect" class="px-2 py-1">
            <SelectCheckbox
              v-if="entry.own"
              :label="t('bulk.selectItem', { name: entry.pattern })"
              :checked="isSelected(String(entry.id))"
              :disabled="!canSelect(String(entry.id))"
              :described-by="limitId"
              @change="emit('toggle', String(entry.id))"
            />
          </td>
          <td class="px-2 py-3 text-gray-700 tabular-nums dark:text-gray-300">{{ entry.id }}</td>
          <td class="px-2 py-3 break-all text-gray-900 dark:text-white">
            <PlainText :value="entry.pattern" />
            <span
              v-if="!entry.own"
              data-read-only
              class="mt-1 block text-xs break-normal text-gray-600 dark:text-gray-400"
              >{{ lt('user.spamfilter_table_domain_policy') }}</span
            >
          </td>
          <td class="px-2 py-3 text-gray-800 dark:text-gray-200">
            <RouterLink
              v-if="!entry.own && ownerLink(entry)"
              :to="ownerLink(entry)!"
              :class="LINK"
              class="-my-3"
              ><PlainText :value="entry.owner.name"
            /></RouterLink>
            <span v-else class="break-all"><PlainText :value="entry.owner.name" /></span>
          </td>
          <td class="px-2 py-3 text-gray-700 dark:text-gray-300">
            <DateTime :value="entry.createdAt" />
          </td>
        </tr>
      </tbody>
    </table>
  </div>
  <div v-else class="flex flex-col gap-3">
    <div v-if="showSelect" class="flex items-center gap-2">
      <SelectCheckbox
        :label="lt('mailbox.toggle_all')"
        :checked="allSelected"
        @change="emit('toggleAll', $event)"
      />
      <span aria-hidden="true" class="text-sm text-gray-700 dark:text-gray-300">{{
        lt('mailbox.toggle_all')
      }}</span>
    </div>
    <ul :aria-label="lt(CAPTION[list])" class="flex flex-col gap-3" :data-entries="list">
      <DataCard
        v-for="entry in entries"
        :key="`${entry.own ? 'own' : 'inherited'}-${entry.id}`"
        :data-entry="entry.id"
        :data-own="entry.own ? 'true' : 'false'"
      >
        <template #title><PlainText :value="entry.pattern" /></template>
        <template v-if="!entry.own" #subtitle>
          <span data-read-only>{{ lt('user.spamfilter_table_domain_policy') }}</span>
        </template>
        <template v-if="showSelect && entry.own" #select>
          <SelectCheckbox
            v-if="entry.own"
            :label="t('bulk.selectItem', { name: entry.pattern })"
            :checked="isSelected(String(entry.id))"
            :disabled="!canSelect(String(entry.id))"
            :described-by="limitId"
            @change="emit('toggle', String(entry.id))"
          />
        </template>
        <DataCardFields>
          <dt class="text-gray-600 dark:text-gray-400">{{ t('lists.id') }}</dt>
          <dd class="text-gray-800 tabular-nums dark:text-gray-200">{{ entry.id }}</dd>
          <dt class="text-gray-600 dark:text-gray-400">{{ t('spamFilter.lists.scope') }}</dt>
          <dd class="min-w-0 text-gray-800 dark:text-gray-200">
            <RouterLink
              v-if="!entry.own && ownerLink(entry)"
              :to="ownerLink(entry)!"
              :class="LINK"
              class="-my-3"
            >
              <PlainText :value="entry.owner.name" />
            </RouterLink>
            <span v-else class="break-all"><PlainText :value="entry.owner.name" /></span>
          </dd>
          <dt class="text-gray-600 dark:text-gray-400">{{ lt('user.created_on') }}</dt>
          <dd class="text-gray-800 dark:text-gray-200"><DateTime :value="entry.createdAt" /></dd>
        </DataCardFields>
      </DataCard>
    </ul>
  </div>
</template>
