<script setup lang="ts">
import { ChevronDownIcon } from '@/shared/icons'

withDefaults(defineProps<{ expanded?: boolean; controls?: string; label?: string }>(), {
  expanded: undefined,
  controls: undefined,
  label: undefined,
})
const emit = defineEmits<{ toggle: [] }>()
</script>

<template>
  <div class="table-row-controls flex items-center justify-end gap-1 whitespace-nowrap">
    <button
      v-if="expanded !== undefined"
      type="button"
      data-row-expand
      class="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-gray-300 dark:hover:bg-gray-800"
      :aria-expanded="expanded"
      :aria-controls="controls"
      :aria-label="label"
      @click="emit('toggle')"
    >
      <ChevronDownIcon
        class="size-5 motion-safe:transition-transform"
        :class="expanded ? 'rotate-180' : ''"
      />
    </button>
    <slot />
  </div>
</template>
