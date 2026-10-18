<script setup lang="ts">
// A control the caller's flags do not allow (FR-041): legacy's "Prohibited by ACL" and the
// permission's legacy label, as two texts (never joined into one sentence).
import type { PermissionFlags } from '@/api'
import { lt } from '@/i18n'
import { LockIcon } from '@/shared/icons'

import { FLAG_LABEL_KEYS } from '../../acl'

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
    <span v-if="FLAG_LABEL_KEYS[flag]" class="font-medium">{{ lt(FLAG_LABEL_KEYS[flag]!) }}</span>
  </p>
</template>
