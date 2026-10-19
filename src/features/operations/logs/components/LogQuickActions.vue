<script setup lang="ts">
// Legacy's quick actions of a log table (`mailbox.quick_actions`; plan decisions 6 and 11): "+ 100"
// and "+ 1000" add further entries, Expand All and Collapse All open or close every entry's details
// (offered when the log has details).
import { useI18n } from 'vue-i18n'

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

withDefaults(defineProps<{ more?: boolean; details: boolean; busy?: boolean }>(), {
  more: true,
  busy: false,
})
const emit = defineEmits<{ more: [size: number]; expandAll: []; collapseAll: [] }>()
const { t } = useI18n()
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger :class="buttonVariants({ variant: 'outline', size: 'sm' })">
      {{ lt('mailbox.quick_actions') }}
      <ChevronDownIcon class="size-4" />
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" class="max-w-[min(20rem,calc(100vw-2rem))]">
      <template v-if="more">
        <DropdownMenuItem class="min-h-11" :disabled="busy" @select="emit('more', 100)">
          {{ t('operations.logs.more100') }}
        </DropdownMenuItem>
        <DropdownMenuItem class="min-h-11" :disabled="busy" @select="emit('more', 1000)">
          {{ t('operations.logs.more1000') }}
        </DropdownMenuItem>
      </template>
      <template v-if="details">
        <DropdownMenuSeparator v-if="more" />
        <DropdownMenuItem class="min-h-11" @select="emit('expandAll')">
          {{ lt('datatables.expand_all') }}
        </DropdownMenuItem>
        <DropdownMenuItem class="min-h-11" @select="emit('collapseAll')">
          {{ lt('datatables.collapse_all') }}
        </DropdownMenuItem>
      </template>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
