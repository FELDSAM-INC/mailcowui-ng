<script setup lang="ts">
// The actions of a list entry: the classic row buttons Edit and Remove (`mailbox.edit`,
// `mailbox.remove`, or the user table's `user.*`), in a menu named after the job.
import { nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { Role, SyncJob } from '@/api'
import { resolveText } from '@/i18n'
import { HorizontalDotsIcon, TrashIcon } from '@/shared/icons'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'

import { jobLabel, listTexts } from '../presentation'

const props = defineProps<{ job: SyncJob; role: Role; canRemove?: boolean }>()
const emit = defineEmits<{ remove: [job: SyncJob] }>()
const { t } = useI18n()
const root = ref<HTMLElement | null>(null)

async function onRemove() {
  // Let the menu close and give the focus back to its trigger, so the dialog returns it there.
  await nextTick()
  requestAnimationFrame(() => {
    root.value?.querySelector<HTMLElement>('button')?.focus()
    emit('remove', props.job)
  })
}
</script>

<template>
  <span ref="root" class="contents">
    <DropdownMenu>
      <DropdownMenuTrigger
        :aria-label="t('syncJobs.list.actionsFor', { name: jobLabel(job) })"
        class="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-gray-300 dark:hover:bg-gray-800"
      >
        <HorizontalDotsIcon class="size-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" class="max-w-[min(20rem,calc(100vw-2rem))]">
        <DropdownMenuItem class="min-h-11" :to="`/sync-jobs/${job.id}`">
          {{ resolveText(listTexts(role).edit, t) }}
        </DropdownMenuItem>
        <DropdownMenuItem v-if="canRemove" class="min-h-11" @select="onRemove">
          <TrashIcon />
          {{ resolveText(listTexts(role).remove, t) }}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </span>
</template>
