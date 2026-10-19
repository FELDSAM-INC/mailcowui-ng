<script setup lang="ts">
// Legacy's "Active" column: ✓ active, ✗ inactive, "—" login disallowed, each with its legacy text
// (`edit.active`, `edit.inactive`, `edit.disable_login`) shown whole, so assistive technology and
// sighted users read the same.
import type { MailboxStatus } from '@/api'
import { text } from '@/i18n'
import { CheckIcon, CloseIcon } from '@/shared/icons'

import { statusLabelKey } from '../../labels'

defineProps<{ status: MailboxStatus }>()
</script>

<template>
  <span
    :data-status="status"
    class="inline-flex max-w-full items-start gap-1 rounded-md px-2 py-0.5 text-sm font-medium"
    :class="{
      'bg-green-50 text-green-800 dark:bg-green-500/15 dark:text-green-300': status === 'active',
      'bg-gray-100 text-gray-800 dark:bg-white/10 dark:text-gray-200': status === 'inactive',
      'bg-amber-50 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200':
        status === 'loginDisabled',
    }"
  >
    <CheckIcon v-if="status === 'active'" class="mt-0.5 size-4 shrink-0" />
    <CloseIcon v-else-if="status === 'inactive'" class="mt-0.5 size-4 shrink-0" />
    <span v-else aria-hidden="true">&#8212;</span>
    <span class="break-words">{{ text(statusLabelKey(status)) }}</span>
  </span>
</template>
