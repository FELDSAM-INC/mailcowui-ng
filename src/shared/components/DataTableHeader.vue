<script setup lang="ts">
import { computed, inject } from 'vue'
import { dataListKey } from '@/shared/composables/useDataList'
import { ChevronDownIcon } from '@/shared/icons'

const props = defineProps<{ column: string }>()
const list = inject(dataListKey)!
const definition = computed(() => list.columns.value.find((item) => item.id === props.column))
const sortable = computed(() => !!definition.value?.sort && !!list.sorting.value)
const current = computed(() => sortable.value && list.sorting.value?.key === definition.value?.sort)
const ariaSort = computed(() =>
  !sortable.value
    ? undefined
    : current.value
      ? list.sorting.value?.order === 'asc'
        ? 'ascending'
        : 'descending'
      : 'none',
)
</script>

<template>
  <th
    v-show="list.visible(column)"
    scope="col"
    :data-column="column"
    :aria-sort="ariaSort"
    class="px-3 py-2 text-start align-bottom"
  >
    <button
      v-if="sortable"
      :data-sort="definition?.sort"
      type="button"
      class="inline-flex min-h-11 min-w-11 items-center gap-1 text-start"
      @click="list.sort(definition!.sort!)"
    >
      {{ definition?.label }}
      <ChevronDownIcon
        class="size-4 shrink-0"
        :class="[
          current ? '' : 'opacity-0',
          current && list.sorting.value?.order === 'asc' ? 'rotate-180' : '',
        ]"
      />
    </button>
    <template v-else>{{ definition?.label }}</template>
  </th>
</template>
