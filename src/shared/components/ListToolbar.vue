<script setup lang="ts">
import { inject, provide, shallowRef, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import { dataListKey, listToolbarTarget } from '@/shared/composables/useDataList'
import { useMediaQuery } from '@/shared/composables/useMediaQuery'
import { ListIcon } from '@/shared/icons'
import RefreshButton from './RefreshButton.vue'
import { buttonVariants } from '@/shared/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuItem,
} from '@/shared/ui/dropdown-menu'

const { t } = useI18n()
const list = inject(dataListKey, undefined)
const id = `list-filters-${useId()}`
const filterContent = shallowRef<HTMLElement | null>(null)
provide(listToolbarTarget, { id, element: filterContent })
const wide = useMediaQuery('(min-width: 768px)')
</script>

<template>
  <div data-list-toolbar class="flex w-full min-w-0 flex-col gap-3">
    <div class="flex min-w-0 flex-wrap items-center gap-2" data-list-controls>
      <div v-if="$slots.select" data-list-select class="shrink-0"><slot name="select" /></div>
      <div v-if="$slots.filters" data-list-filters class="shrink-0"><slot name="filters" /></div>
      <div v-if="$slots.search" data-list-search class="min-w-32 flex-1">
        <slot name="search" />
      </div>
      <DropdownMenu v-if="list">
        <DropdownMenuTrigger
          data-list-columns
          :class="buttonVariants({ variant: 'outline' })"
          :disabled="!list.columns.value.length"
        >
          <ListIcon />{{ t('lists.columns') }}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuCheckboxItem
            v-for="column in list.columns.value"
            v-show="wide"
            :key="column.id"
            class="min-h-11"
            :data-column-option="column.id"
            :model-value="list.visible(column.id)"
            :disabled="list.visible(column.id) && list.visibleCount.value <= 1"
            @update:model-value="(checked) => list?.setVisible(column.id, checked === true)"
            @select.prevent
          >
            {{ column.label }}
          </DropdownMenuCheckboxItem>
          <template v-if="!wide && list.sorting.value">
            <DropdownMenuSeparator />
            <DropdownMenuLabel>{{ t('lists.sort.label') }}</DropdownMenuLabel>
            <DropdownMenuItem
              v-for="column in list.columns.value.filter((item) => item.sort)"
              :key="`sort-${column.id}`"
              :data-sort-choice="column.sort"
              class="min-h-11"
              @select="list.sort(column.sort!)"
            >
              {{ column.label
              }}<span v-if="list.sorting.value.key === column.sort" aria-hidden="true">{{
                list.sorting.value.order === 'asc' ? '▲' : '▼'
              }}</span>
            </DropdownMenuItem>
          </template>
        </DropdownMenuContent>
      </DropdownMenu>
      <RefreshButton
        v-if="list?.refresh.value"
        :pending="list.refresh.value.pending"
        :disabled="list.refresh.value.disabled"
        @refresh="list.refresh.value?.run()"
      />
      <slot name="actions" />
    </div>
    <div :id="id" ref="filterContent" class="empty:hidden" data-list-filter-content />
  </div>
</template>
