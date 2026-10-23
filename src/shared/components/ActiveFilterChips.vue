<script setup lang="ts">
import TagChip from '@/shared/components/TagChip.vue'

// A list's active filters as removable chips (conventions "Lists", UI 001 FR-073, UI 004 FR-010),
// promoted from the audit log (UI 001 R20). The parent builds the chips from its list state; a chip
// is removed by its key, or all at once. Each chip's accessible name starts with "Remove filter"
// and contains its visible text. UI 004: a chip may instead name a message key (`messageKey`, an
// enumeration value whose legacy text has markup), rendered through MessageText.
import { useI18n } from 'vue-i18n'

import { buttonVariants } from '../ui/button'
import MessageText from './MessageText.vue'

import type { FilterChip } from './filter-chip'

export type { FilterChip }

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
        <TagChip
          :aria-label="
            chip.messageKey ? undefined : t('lists.chips.remove', { filter: chip.label })
          "
          removable
          @click="emit('remove', chip.key)"
          ><span v-if="chip.messageKey" class="min-w-0 wrap-anywhere">
            <span class="sr-only">{{ t('lists.chips.remove', { filter: '' }) }}</span>
            <MessageText :k="chip.messageKey" /> </span
          ><span v-else class="min-w-0 wrap-anywhere">{{ chip.label }}</span></TagChip
        >
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
