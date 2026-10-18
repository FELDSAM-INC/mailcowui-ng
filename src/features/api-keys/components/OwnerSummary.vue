<script setup lang="ts">
// A key's owner: username and role, with a warning in text when the owner is deactivated or
// deleted, because the key is then rejected (FR-064, US7-AS7).
import { useI18n } from 'vue-i18n'

import type { ApiKeyOwner } from '@/api'
import { text } from '@/i18n'
import { WarningIcon } from '@/shared/icons'

defineProps<{ owner: ApiKeyOwner }>()
const { t } = useI18n()
</script>

<template>
  <span class="flex min-w-0 flex-col">
    <span class="wrap-anywhere">
      <span class="font-medium text-gray-900 dark:text-white">{{ owner.username }}</span>
      <span class="text-gray-600 dark:text-gray-400">
        · {{ owner.role ? text(`roles.${owner.role}`) : t('apiKeys.owner.deleted') }}
      </span>
    </span>
    <span
      v-if="!owner.active"
      class="mt-1 flex gap-1.5 text-sm font-medium text-warning-800 dark:text-warning-200"
    >
      <WarningIcon class="mt-0.5 size-4 shrink-0" />
      <span>{{ t('apiKeys.owner.unusable') }}</span>
    </span>
  </span>
</template>
