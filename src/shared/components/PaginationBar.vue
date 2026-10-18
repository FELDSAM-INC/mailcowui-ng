<script setup lang="ts">
// Pages, total count and page size of a list (conventions "Lists", research R20), on TailAdmin's
// pagination. The page size is a native <select> (research R18).
import { computed, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import { ChevronLeftIcon, ChevronRightIcon } from '../icons'
import { buttonVariants } from '../ui/button'
import { Pagination } from '../ui/pagination'
import { formatNumber } from '@/i18n/format'
import type { AppLocale } from '@/i18n/locales'

const props = withDefaults(
  defineProps<{ total: number; page: number; size: number; pageSizes?: readonly number[] }>(),
  { pageSizes: () => [25, 50, 100] },
)
const emit = defineEmits<{ 'update:page': [page: number]; 'update:size': [size: number] }>()

const { t, locale } = useI18n()
const sizeId = useId()

const pages = computed(() => Math.max(1, Math.ceil(props.total / props.size)))
const number = (value: number) => formatNumber(value, locale.value as AppLocale)
const summary = computed(() => {
  if (props.total === 0) return t('lists.pagination.empty')
  const from = (props.page - 1) * props.size + 1
  const to = Math.min(props.total, props.page * props.size)
  return t('lists.pagination.summary', {
    from: number(from),
    to: number(to),
    total: number(props.total),
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
      <div class="flex items-center gap-2">
        <label :for="sizeId" class="text-sm text-gray-700 dark:text-gray-300">
          {{ t('lists.pagination.pageSize') }}
        </label>
        <select
          :id="sizeId"
          :value="size"
          class="h-11 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
          @change="onSize"
        >
          <option v-for="option in pageSizes" :key="option" :value="option">{{ option }}</option>
        </select>
      </div>
      <Pagination class="mx-0 w-auto">
        <div class="flex items-center gap-1">
          <button
            type="button"
            :class="buttonVariants({ variant: 'outline', size: 'icon' })"
            :aria-label="t('a11y.previousPage')"
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
            :aria-label="t('a11y.nextPage')"
            :disabled="page >= pages"
            @click="emit('update:page', page + 1)"
          >
            <ChevronRightIcon />
          </button>
        </div>
      </Pagination>
    </div>
  </div>
</template>
