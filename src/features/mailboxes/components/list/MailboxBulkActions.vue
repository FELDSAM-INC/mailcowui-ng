<script setup lang="ts">
// The mass action menus of the selection bar, as legacy's `mass-actions-mailbox` button groups:
// "Mailbox" (activate, disallow login, deactivate, then remove) and "Allowed protocols" (each
// protocol under its hard-coded header with activate and deactivate), which a domain administrator
// without `protocolAccess` does not get (FR-053, US6-AS4).
import { lt } from '@/i18n'
import { ChevronDownIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'

import { PROTOCOL_HEADERS, STATUS_ACTIONS, type MailboxBulkChoice } from '../../bulk'

withDefaults(defineProps<{ disabled?: boolean; protocols?: boolean; tls?: boolean }>(), {
  disabled: false,
  protocols: true,
  tls: true,
})
const emit = defineEmits<{ run: [choice: MailboxBulkChoice] }>()
</script>

<template>
  <template v-if="tls">
    <DropdownMenu v-for="direction in ['inbound', 'outbound'] as const" :key="direction">
      <DropdownMenuTrigger
        :class="buttonVariants({ variant: 'outline' })"
        :disabled="disabled"
        :data-bulk-menu="`tls-${direction}`"
      >
        {{ lt(direction === 'inbound' ? 'mailbox.tls_enforce_in' : 'mailbox.tls_enforce_out') }}
        <ChevronDownIcon class="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          v-for="enabled in [true, false]"
          :key="String(enabled)"
          class="min-h-11"
          :data-bulk-action="`tls-${direction}-${enabled ? 'activate' : 'deactivate'}`"
          @select="emit('run', { action: 'setTlsEnforcement', direction, enabled })"
        >
          {{ lt(enabled ? 'mailbox.activate' : 'mailbox.deactivate') }}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </template>
  <DropdownMenu>
    <DropdownMenuTrigger
      :class="buttonVariants({ variant: 'outline' })"
      :disabled="disabled"
      data-bulk-menu="mailbox"
    >
      {{ lt('mailbox.mailbox') }}
      <ChevronDownIcon class="size-4" />
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="max-w-[min(22rem,calc(100vw-2rem))]">
      <DropdownMenuItem
        v-for="item in STATUS_ACTIONS"
        :key="item.action"
        class="min-h-11"
        :data-bulk-action="item.action"
        @select="emit('run', { action: item.action })"
      >
        {{ lt(item.label) }}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        class="min-h-11 text-red-700 dark:text-red-400"
        data-bulk-action="delete"
        @select="emit('run', { action: 'delete' })"
      >
        {{ lt('mailbox.remove') }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
  <DropdownMenu v-if="protocols">
    <DropdownMenuTrigger
      :class="buttonVariants({ variant: 'outline' })"
      :disabled="disabled"
      data-bulk-menu="protocols"
    >
      {{ lt('mailbox.allowed_protocols') }}
      <ChevronDownIcon class="size-4" />
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="max-h-[70vh] overflow-y-auto">
      <template v-for="(item, index) in PROTOCOL_HEADERS" :key="item.protocol">
        <DropdownMenuSeparator v-if="index > 0" />
        <DropdownMenuLabel>{{ item.text }}</DropdownMenuLabel>
        <DropdownMenuItem
          class="min-h-11"
          :data-bulk-action="`allow-${item.protocol}`"
          @select="emit('run', { action: 'allowProtocol', protocol: item.protocol })"
        >
          {{ lt('mailbox.activate') }}
          <span class="sr-only">{{ item.text }}</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          class="min-h-11"
          :data-bulk-action="`disallow-${item.protocol}`"
          @select="emit('run', { action: 'disallowProtocol', protocol: item.protocol })"
        >
          {{ lt('mailbox.deactivate') }}
          <span class="sr-only">{{ item.text }}</span>
        </DropdownMenuItem>
      </template>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
