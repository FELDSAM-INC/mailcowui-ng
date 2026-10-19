<script setup lang="ts">
// A control the caller's flags do not allow (UI 003 FR-041, UI 006 FR-003): legacy's "Prohibited
// by ACL" and the permission's legacy label, as two texts (never joined into one sentence).
// Promoted from UI 003 at its second use (UI 006, research R7); the label is the flag's `acl.*`
// key (`quarantineAttachments` → `acl.quarantine_attachments`).
import type { PermissionFlags } from '@/api'
import { lt } from '@/i18n'
import { flagLabel } from '@/i18n/problems'
import { LockIcon } from '@/shared/icons'

defineProps<{ id: string; flag: keyof PermissionFlags }>()
</script>

<template>
  <p
    :id="id"
    data-acl-note
    class="flex flex-wrap items-center gap-x-2 text-sm text-gray-700 dark:text-gray-300"
  >
    <LockIcon class="size-4 shrink-0" />
    <span>{{ lt('acl.prohibited') }}</span>
    <span class="font-medium">{{ flagLabel(flag) }}</span>
  </p>
</template>
