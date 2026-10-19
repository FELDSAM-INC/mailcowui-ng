<script setup lang="ts">
// The actions of a domain alias entry (FR-015), the classic table's action column as a menu behind
// a 44 × 44 trigger: Edit (`mailbox.edit`), which opens the page with its section open, and Remove
// (`mailbox.remove`). Deletion lives only in the list, as in legacy.
import { nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import type { AliasDomain } from '@/api'
import { lt } from '@/i18n'
import { HorizontalDotsIcon, TrashIcon } from '@/shared/icons'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'

const props = defineProps<{ aliasDomain: AliasDomain }>()
const emit = defineEmits<{ delete: [aliasDomain: AliasDomain] }>()
const { t } = useI18n()
const router = useRouter()
const root = ref<HTMLElement | null>(null)

function onEdit() {
  void router.push({
    name: 'alias-domain-detail',
    params: { aliasDomain: props.aliasDomain.name },
    query: { edit: 'general' },
  })
}

async function onDelete() {
  // Let the menu close and put the focus back on its trigger first, so the dialog returns it there.
  await nextTick()
  requestAnimationFrame(() => {
    root.value?.querySelector<HTMLElement>('button')?.focus()
    emit('delete', props.aliasDomain)
  })
}
</script>

<template>
  <span ref="root" class="contents">
    <DropdownMenu>
      <DropdownMenuTrigger
        :aria-label="t('lists.actionsFor', { name: aliasDomain.nameUnicode })"
        class="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-gray-300 dark:hover:bg-gray-800"
      >
        <HorizontalDotsIcon class="size-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" class="max-w-[min(20rem,calc(100vw-2rem))]">
        <DropdownMenuItem class="min-h-11" @select="onEdit">
          {{ lt('mailbox.edit') }}
        </DropdownMenuItem>
        <DropdownMenuItem class="min-h-11" @select="onDelete">
          <TrashIcon />
          {{ lt('mailbox.remove') }}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </span>
</template>
