<script setup lang="ts">
import { Badge } from '@/shared/ui/badge'

// Legacy's badge for an alias domain whose target is a relay (backup MX) domain
// (`mailbox.alias_domain_backupmx`, US4-AS9), as text with an icon, never by colour alone.
import { lt } from '@/i18n'
import { WarningIcon } from '@/shared/icons'
</script>

<template>
  <Badge data-relay-warning color="warning">
    <WarningIcon class="size-3.5 shrink-0" />
    <span class="break-words">{{ lt('mailbox.alias_domain_backupmx') }}</span>
  </Badge>
</template>
