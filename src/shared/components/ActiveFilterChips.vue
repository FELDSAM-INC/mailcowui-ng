<script setup lang="ts">
// A list's active filters as removable chips (conventions "Lists", UI 001 FR-073, UI 004 FR-010),
// promoted from the audit log (UI 001 R20). The parent builds the chips from its list state; a chip
// is removed by its key, or all at once. Each chip's accessible name starts with "Remove filter"
// and contains its visible text.
import { useI18n } from 'vue-i18n'

import { CloseIcon } from '../icons'
import { buttonVariants } from '../ui/button'

export interface FilterChip {
  key: string
  label: string
}

defineProps<{ chips: readonly FilterChip[] }>()
const emit = defineEmits<{ remove: [key: string]; clear: [] }>()
const { t } = useI18n()
</script>

<template>
  <section
    v-if="chips.length > 0"
    :aria-label="t('lists.chips.label')"
    class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center"
  >
    <ul class="flex flex-wrap gap-2">
      <li v-for="chip in chips" :key="chip.key" class="max-w-full min-w-0">
        <button
          type="button"
          :aria-label="t('lists.chips.remove', { filter: chip.label })"
          class="inline-flex min-h-11 max-w-full items-center gap-2 rounded-full border border-gray-300 bg-white px-3 text-sm text-gray-800 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-white/5"
          @click="emit('remove', chip.key)"
        >
          <span class="min-w-0 wrap-anywhere">{{ chip.label }}</span>
          <CloseIcon class="size-4 shrink-0" />
        </button>
      </li>
    </ul>
    <button
      type="button"
      :class="buttonVariants({ variant: 'ghost', class: 'self-start' })"
      @click="emit('clear')"
    >
      {{ t('lists.chips.clearAll') }}
    </button>
  </section>
</template>
