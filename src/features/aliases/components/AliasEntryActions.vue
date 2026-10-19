<script setup lang="ts">
// The actions of an alias entry (FR-015), the classic table's action column (`draw_alias_table()`)
// as a menu behind a 44 × 44 trigger: Edit (`mailbox.edit`), which opens the alias with its section
// open, "Expand alias over alias domains" (`mailbox.add_alias_expand`, US6) for an alias of a
// primary domain, and Remove (`mailbox.remove`). Deletion and the expansion live only in the list,
// as in legacy.
import { nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import type { Alias } from '@/api'
import { lt } from '@/i18n'
import { HorizontalDotsIcon, TrashIcon } from '@/shared/icons'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'

const props = defineProps<{ alias: Alias }>()
const emit = defineEmits<{ delete: [alias: Alias]; copy: [alias: Alias] }>()
const { t } = useI18n()
const router = useRouter()
const root = ref<HTMLElement | null>(null)

function onEdit() {
  void router.push({
    name: 'alias-detail',
    params: { aliasId: props.alias.id },
    query: { edit: 'alias' },
  })
}

/** Legacy offers the expansion for aliases of a primary domain only (FR-031). */
const canCopy = () => !props.alias.inAliasDomain && !props.alias.orphaned

async function after(event: 'delete' | 'copy') {
  // Let the menu close and put the focus back on its trigger first, so the dialog returns it there.
  await nextTick()
  requestAnimationFrame(() => {
    root.value?.querySelector<HTMLElement>('button')?.focus()
    if (event === 'delete') emit('delete', props.alias)
    else emit('copy', props.alias)
  })
}
</script>

<template>
  <span ref="root" class="contents">
    <DropdownMenu>
      <DropdownMenuTrigger
        :aria-label="t('lists.actionsFor', { name: alias.addressUnicode })"
        class="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-gray-300 dark:hover:bg-gray-800"
      >
        <HorizontalDotsIcon class="size-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" class="max-w-[min(20rem,calc(100vw-2rem))]">
        <DropdownMenuItem class="min-h-11" @select="onEdit">
          {{ lt('mailbox.edit') }}
        </DropdownMenuItem>
        <DropdownMenuItem v-if="canCopy()" class="min-h-11" @select="after('copy')">
          {{ lt('mailbox.add_alias_expand') }}
        </DropdownMenuItem>
        <DropdownMenuItem class="min-h-11" @select="after('delete')">
          <TrashIcon />
          {{ lt('mailbox.remove') }}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </span>
</template>
