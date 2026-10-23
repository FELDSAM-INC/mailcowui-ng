<script setup lang="ts">
// The action bar of a selection (UI 002 research D22, FR-045, US5-AS4): names the number of
// selected items, offers the actions, and states the bulk limit when it is reached. It sticks to
// the bottom of the viewport on small screens, so the actions stay reachable (FR-069). UI 004: the
// focused entry is kept clear of the bar (WCAG 2.4.11, `useStickyBarFocus`). UI 003: the default
// slot adds controls after the action buttons, for example grouped action menus.
import { computed, nextTick, ref, useId, useSlots, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { lt } from '@/i18n'
import { ChevronDownIcon, CloseIcon } from '@/shared/icons'

import { useMediaQuery } from '../composables/useMediaQuery'
import { useStickyBarFocus } from '../composables/useStickyBarFocus'
import { buttonVariants } from '../ui/button'

export interface BulkAction {
  id: string
  label: string
  destructive?: boolean
}

const props = withDefaults(
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
const slots = useSlots()
const wide = useMediaQuery('(min-width: 768px)')
const compact = computed(() => !wide.value && (props.actions.length > 2 || !!slots.default))
const expanded = ref(false)
const toggle = ref<HTMLButtonElement | null>(null)
const selected = ref<HTMLElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const panelId = `bulk-actions-${useId()}`

async function closeActions() {
  expanded.value = false
  await nextTick()
  if (toggle.value && !toggle.value.disabled) toggle.value.focus()
  else selected.value?.focus()
}

async function runAction(id: string) {
  // Confirmations must restore focus to a visible control when they close.
  if (compact.value) await closeActions()
  emit('action', id)
}

watch([compact, () => props.count], ([isCompact, count]) => {
  if (!isCompact || count === 0) {
    const focusInPanel = panel.value?.contains(document.activeElement)
    expanded.value = false
    if (isCompact && focusInPanel) void closeActions()
  }
})
useStickyBarFocus()
</script>

<template>
  <div
    data-bulk-bar
    role="region"
    :aria-label="t('bulk.actions')"
    class="sticky bottom-0 z-20 -mx-4 flex flex-col gap-2 border-t border-gray-200 bg-white px-4 py-3 shadow-theme-lg sm:mx-0 sm:rounded-xl sm:border dark:border-gray-800 dark:bg-gray-900"
  >
    <div class="flex flex-wrap items-center gap-2 max-md:gap-1">
      <p
        ref="selected"
        tabindex="-1"
        class="me-auto shrink-0 font-medium text-gray-900 max-md:text-sm dark:text-white"
        aria-live="polite"
      >
        {{ t('bulk.selected', { count }) }}
      </p>
      <button
        v-if="compact"
        ref="toggle"
        data-bulk-toggle
        type="button"
        :class="buttonVariants({ variant: 'outline' })"
        :aria-expanded="expanded"
        :aria-controls="panelId"
        :disabled="(count === 0 || busy) && !expanded"
        @click="expanded = !expanded"
      >
        {{ lt('mailbox.quick_actions') }}
        <ChevronDownIcon class="size-4 transition-transform" :class="{ 'rotate-180': expanded }" />
      </button>
      <!-- Escape bubbles from the panel's controls; the group itself is not interactive. -->
      <!-- eslint-disable-next-line vuejs-accessibility/no-static-element-interactions -->
      <div
        v-show="!compact || expanded"
        :id="panelId"
        ref="panel"
        data-bulk-actions
        role="group"
        :aria-label="t('bulk.actions')"
        :class="
          compact
            ? 'order-last grid max-h-[min(50dvh,20rem)] w-full grid-cols-2 gap-2 overflow-y-auto border-t border-gray-200 pt-3 mt-2 dark:border-gray-800 [&>button]:h-auto [&>button]:min-h-11 [&>button]:min-w-0 [&>button]:w-full [&>button]:px-2 [&>button]:whitespace-normal [&>select]:col-span-2'
            : 'flex min-w-0 flex-1 gap-1 md:contents max-md:[&>button]:h-auto max-md:[&>button]:min-h-11 max-md:[&>button]:min-w-0 max-md:[&>button]:flex-auto max-md:[&>button]:px-2 max-md:[&>button]:text-xs max-md:[&>button]:whitespace-normal'
        "
        @keydown.esc="compact && closeActions()"
      >
        <button
          v-for="action in actions"
          :key="action.id"
          :data-bulk-action="action.id"
          type="button"
          :class="buttonVariants({ variant: action.destructive ? 'destructive' : 'outline' })"
          :disabled="count === 0 || busy"
          @click="runAction(action.id)"
        >
          {{ action.label }}
        </button>
        <slot :disabled="count === 0 || busy" />
      </div>
      <button
        type="button"
        :class="[buttonVariants({ variant: 'ghost' }), 'max-md:size-11 max-md:p-0!']"
        :aria-label="t('bulk.clear')"
        :title="t('bulk.clear')"
        :disabled="count === 0 || busy"
        @click="emit('clear')"
      >
        <CloseIcon class="size-5 md:hidden" />
        <span class="max-md:hidden">{{ t('bulk.clear') }}</span>
      </button>
    </div>
    <p v-if="limitMessage" :id="limitId" class="text-sm text-gray-700 dark:text-gray-300">
      {{ limitMessage }}
    </p>
  </div>
</template>
