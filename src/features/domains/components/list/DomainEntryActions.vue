<script setup lang="ts">
// The actions of a list entry (FR-041; UI 010 adds "DNS check" here, data-model §9): Delete, which
// is unavailable with its reason while mailboxes or resources are in use.
import { nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { Domain } from '@/api'
import { lt } from '@/i18n'
import { HorizontalDotsIcon, TrashIcon } from '@/shared/icons'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'

import { deletionAvailability } from '../../composables/useDomainDeletion'

const props = defineProps<{ domain: Domain }>()
const emit = defineEmits<{ delete: [domain: Domain] }>()
const { t } = useI18n()
const availability = () => deletionAvailability(props.domain)

const root = ref<HTMLElement | null>(null)

async function onDelete() {
  // Let the menu close and put the focus back on its trigger first, so the dialog returns it there.
  await nextTick()
  requestAnimationFrame(() => {
    root.value?.querySelector<HTMLElement>('button')?.focus()
    emit('delete', props.domain)
  })
}
</script>

<template>
  <span ref="root" class="contents">
    <DropdownMenu>
      <DropdownMenuTrigger
        :aria-label="t('domains.list.actionsFor', { name: domain.unicodeName })"
        class="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-gray-300 dark:hover:bg-gray-800"
      >
        <HorizontalDotsIcon class="size-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" class="max-w-[min(20rem,calc(100vw-2rem))]">
        <DropdownMenuItem class="min-h-11" :disabled="!availability().available" @select="onDelete">
          <TrashIcon />
          <span class="flex flex-col">
            <span>{{ lt('mailbox.remove') }}</span>
            <span v-if="!availability().available" class="text-xs text-gray-600 dark:text-gray-400">
              {{
                t(
                  'domains.delete.unavailable',
                  availability() as { mailboxes: number; resources: number },
                )
              }}
            </span>
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </span>
</template>
