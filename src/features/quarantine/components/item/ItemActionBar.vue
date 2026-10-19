<script setup lang="ts">
// The item's actions (UI 006 FR-024, research R13, legacy form map screen 2 and D3): legacy's
// "Deliver to inbox", "Learn as spam and delete", "Download (.eml)", then "Release" (without
// learning, in the place of legacy's quick release link) and "Remove", each only when the flags
// allow it. The bar sticks to the bottom of the viewport, so the actions stay reachable without
// scrolling through the message (focused elements are kept clear of it). Below md it shows
// "Deliver to inbox" and legacy's "Actions" menu (`quarantine.quick_actions`) with the others in
// the same order. Everything is disabled while an action runs (FR-031).
import { computed } from 'vue'

import { lt, type LegacyKey } from '@/i18n'
import { useMediaQuery } from '@/shared/composables/useMediaQuery'
import { useStickyBarFocus } from '@/shared/composables/useStickyBarFocus'
import { ChevronDownIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'

import type { ItemActionKind } from '../../api'

export type ItemBarAction = ItemActionKind | 'download'

const props = withDefaults(
  defineProps<{ canAct: boolean; canDownload: boolean; busy?: boolean }>(),
  { busy: false },
)
const emit = defineEmits<{ action: [action: ItemBarAction] }>()
const wide = useMediaQuery('(min-width: 768px)')
useStickyBarFocus()

interface Entry {
  id: ItemBarAction
  label: LegacyKey
  destructive?: boolean
}

const entries = computed<Entry[]>(() =>
  (
    [
      props.canAct && { id: 'release', label: 'quarantine.deliver_inbox' },
      props.canAct && {
        id: 'learnAsSpam',
        label: 'quarantine.learn_spam_delete',
        destructive: true,
      },
      props.canDownload && { id: 'download', label: 'quarantine.download_eml' },
      props.canAct && { id: 'releaseWithoutLearning', label: 'quarantine.release' },
      props.canAct && { id: 'delete', label: 'quarantine.remove', destructive: true },
    ] as (Entry | false)[]
  ).filter((entry): entry is Entry => !!entry),
)
const primary = computed(() => (wide.value ? entries.value : entries.value.slice(0, 1)))
const more = computed(() => (wide.value ? [] : entries.value.slice(1)))
</script>

<template>
  <div
    v-if="entries.length > 0"
    data-item-actions
    data-sticky-save
    class="sticky bottom-0 z-20 -mx-4 flex flex-wrap items-center gap-2 border-t border-gray-200 bg-white px-4 py-3 shadow-theme-lg sm:mx-0 sm:rounded-xl sm:border dark:border-gray-800 dark:bg-gray-900"
  >
    <button
      v-for="entry in primary"
      :key="entry.id"
      type="button"
      :data-item-action="entry.id"
      :class="
        buttonVariants({
          variant: entry.id === 'release' ? 'default' : entry.destructive ? 'destructive' : 'outline',
        })
      "
      :disabled="busy"
      @click="emit('action', entry.id)"
    >
      {{ lt(entry.label) }}
    </button>
    <DropdownMenu v-if="more.length > 0">
      <DropdownMenuTrigger
        :class="buttonVariants({ variant: 'outline' })"
        :disabled="busy"
        data-item-actions-menu
      >
        {{ lt('quarantine.quick_actions') }}
        <ChevronDownIcon class="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" class="max-w-[min(22rem,calc(100vw-2rem))]">
        <DropdownMenuItem
          v-for="entry in more"
          :key="entry.id"
          class="min-h-11"
          :class="entry.destructive ? 'text-red-700 dark:text-red-400' : ''"
          :data-item-action="entry.id"
          @select="emit('action', entry.id)"
        >
          {{ lt(entry.label) }}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</template>
