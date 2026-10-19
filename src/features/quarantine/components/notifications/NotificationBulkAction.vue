<script setup lang="ts">
// The quarantine notification group of UI 003's mass action menus (UI 006 US3, FR-041, legacy form
// map screen 4, D21): legacy's `mailbox.quarantine_notification` menu with the frequencies
// (hourly, daily, weekly, never), a divider and the categories (rejected, junk folder, all), in
// legacy order and with legacy's labels.
import { lt } from '@/i18n'
import { ChevronDownIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'

import { NOTIFICATION_BULK_OPTIONS, type NotificationBulkChoice } from '../../notification-bulk'

withDefaults(defineProps<{ disabled?: boolean }>(), { disabled: false })
const emit = defineEmits<{ run: [choice: NotificationBulkChoice] }>()
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger
      :class="buttonVariants({ variant: 'outline' })"
      :disabled="disabled"
      data-bulk-menu="quarantine-notification"
    >
      {{ lt('mailbox.quarantine_notification') }}
      <ChevronDownIcon class="size-4" />
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="max-w-[min(22rem,calc(100vw-2rem))]">
      <template v-for="(group, index) in NOTIFICATION_BULK_OPTIONS" :key="index">
        <DropdownMenuSeparator v-if="index > 0" />
        <DropdownMenuItem
          v-for="option in group"
          :key="option.id"
          class="min-h-11"
          :data-bulk-action="option.id"
          @select="emit('run', option.choice)"
        >
          {{ lt(option.labelKey) }}
        </DropdownMenuItem>
      </template>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
