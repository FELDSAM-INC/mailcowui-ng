<script setup lang="ts">
// Legacy's badge for an alias domain whose target is a relay (backup MX) domain
// (`mailbox.alias_domain_backupmx`, US4-AS9), as text with an icon, never by colour alone.
import { lt } from '@/i18n'
import { WarningIcon } from '@/shared/icons'
</script>

<template>
  <span
    data-relay-warning
    class="inline-flex max-w-full items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-100"
  >
    <WarningIcon class="size-3.5 shrink-0" />
    <span class="break-words">{{ lt('mailbox.alias_domain_backupmx') }}</span>
  </span>
</template>
