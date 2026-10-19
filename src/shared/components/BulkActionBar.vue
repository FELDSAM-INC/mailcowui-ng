<script setup lang="ts">
// The action bar of a selection (UI 002 research D22, FR-045, US5-AS4): names the number of
// selected items, offers the actions, and states the bulk limit when it is reached. It sticks to
// the bottom of the viewport on small screens, so the actions stay reachable (FR-069). UI 004: the
// focused entry is kept clear of the bar (WCAG 2.4.11, `useStickyBarFocus`). UI 003: the default
// slot adds controls after the action buttons, for example grouped action menus.
import { useI18n } from 'vue-i18n'

import { useStickyBarFocus } from '../composables/useStickyBarFocus'
import { buttonVariants } from '../ui/button'

export interface BulkAction {
  id: string
  label: string
  destructive?: boolean
}

withDefaults(
  defineProps<{
    count: number
    actions: readonly BulkAction[]
    limitMessage?: string | null
    /** The ID of the limit message, which disabled checkboxes point to. */
    limitId?: string
    busy?: boolean
  }>(),
  { limitMessage: null, limitId: 'bulk-limit-message', busy: false },
)
const emit = defineEmits<{ action: [id: string]; clear: [] }>()
const { t } = useI18n()
useStickyBarFocus()
</script>

<template>
  <div
    data-bulk-bar
    role="region"
    :aria-label="t('bulk.actions')"
    class="sticky bottom-0 z-20 -mx-4 flex flex-col gap-2 border-t border-gray-200 bg-white px-4 py-3 shadow-theme-lg sm:mx-0 sm:rounded-xl sm:border dark:border-gray-800 dark:bg-gray-900"
  >
    <div class="flex flex-wrap items-center gap-2">
      <p class="me-auto font-medium text-gray-900 dark:text-white" aria-live="polite">
        {{ t('bulk.selected', { count }) }}
      </p>
      <button
        v-for="action in actions"
        :key="action.id"
        type="button"
        :class="buttonVariants({ variant: action.destructive ? 'destructive' : 'outline' })"
        :disabled="count === 0 || busy"
        @click="emit('action', action.id)"
      >
        {{ action.label }}
      </button>
      <slot :disabled="count === 0 || busy" />
      <button
        type="button"
        :class="buttonVariants({ variant: 'ghost' })"
        :disabled="count === 0 || busy"
        @click="emit('clear')"
      >
        {{ t('bulk.clear') }}
      </button>
    </div>
    <p v-if="limitMessage" :id="limitId" class="text-sm text-gray-700 dark:text-gray-300">
      {{ limitMessage }}
    </p>
  </div>
</template>
