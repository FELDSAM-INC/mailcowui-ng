<script setup lang="ts">
// Pages, total count and page size of a list (conventions "Lists", research R20), on TailAdmin's
// pagination, with the texts of the classic interface's DataTables (`datatables.*`): the entries
// shown, "Show _MENU_ entries" with the page size as a native <select> (research R18) in the place
// of `_MENU_`, and First, Previous, Next and Last (UI 002, FR-005).
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { lt } from '@/i18n'
import { formatNumber } from '@/i18n/format'
import type { AppLocale } from '@/i18n/locales'

import {
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '../icons'
import { buttonVariants } from '../ui/button'
import { Pagination } from '../ui/pagination'
import LegacyText from './LegacyText.vue'

const props = withDefaults(
  defineProps<{ total: number; page: number; size: number; pageSizes?: readonly number[] }>(),
  { pageSizes: () => [25, 50, 100] },
)
const emit = defineEmits<{ 'update:page': [page: number]; 'update:size': [size: number] }>()

const { t, locale } = useI18n()

const pages = computed(() => Math.max(1, Math.ceil(props.total / props.size)))
const number = (value: number) => formatNumber(value, locale.value as AppLocale)
const summary = computed(() => {
  if (props.total === 0) return lt('datatables.infoEmpty')
  const from = (props.page - 1) * props.size + 1
  const to = Math.min(props.total, props.page * props.size)
  return lt('datatables.info', {
    _START_: number(from),
    _END_: number(to),
    _TOTAL_: number(props.total),
  })
})

function onSize(event: Event) {
  emit('update:size', Number((event.target as HTMLSelectElement).value))
}
</script>

<template>
  <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <p class="text-sm text-gray-700 dark:text-gray-300">{{ summary }}</p>
    <div class="flex flex-wrap items-center gap-3">
      <LegacyText
        k="datatables.lengthMenu"
        as="label"
        data-page-size
        class="flex items-center gap-2 text-sm whitespace-pre text-gray-700 dark:text-gray-300"
      >
        <template #_MENU_>
          <!-- eslint-disable-next-line vuejs-accessibility/form-control-has-label -- inside LegacyText's <label> ("Show _MENU_ entries") -->
          <select
            :value="size"
            class="h-11 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
            @change="onSize"
          >
            <option v-for="option in pageSizes" :key="option" :value="option">
              {{ option }}
            </option>
          </select>
        </template>
      </LegacyText>
      <Pagination class="mx-0 w-auto">
        <div class="flex items-center gap-1">
          <button
            type="button"
            :class="buttonVariants({ variant: 'outline', size: 'icon' })"
            :aria-label="lt('datatables.paginate.first')"
            :disabled="page <= 1"
            @click="emit('update:page', 1)"
          >
            <ChevronDoubleLeftIcon />
          </button>
          <button
            type="button"
            :class="buttonVariants({ variant: 'outline', size: 'icon' })"
            :aria-label="lt('datatables.paginate.previous')"
            :disabled="page <= 1"
            @click="emit('update:page', page - 1)"
          >
            <ChevronLeftIcon />
          </button>
          <span class="px-2 text-sm text-gray-700 dark:text-gray-300" aria-live="polite">
            {{ t('lists.pagination.current', { page: number(page), pages: number(pages) }) }}
          </span>
          <button
            type="button"
            :class="buttonVariants({ variant: 'outline', size: 'icon' })"
            :aria-label="lt('datatables.paginate.next')"
            :disabled="page >= pages"
            @click="emit('update:page', page + 1)"
          >
            <ChevronRightIcon />
          </button>
          <button
            type="button"
            :class="buttonVariants({ variant: 'outline', size: 'icon' })"
            :aria-label="lt('datatables.paginate.last')"
            :disabled="page >= pages"
            @click="emit('update:page', pages)"
          >
            <ChevronDoubleRightIcon />
          </button>
        </div>
      </Pagination>
    </div>
  </div>
</template>
