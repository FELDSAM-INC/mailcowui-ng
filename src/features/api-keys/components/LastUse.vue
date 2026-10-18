<script setup lang="ts">
// The last use of a key: time and client address, or "never used" (FR-064).
import { useI18n } from 'vue-i18n'

import type { ApiKey } from '@/api'
import DateTime from '@/shared/components/DateTime.vue'

defineProps<{ apiKey: Pick<ApiKey, 'lastUsedAt' | 'lastUsedFrom'> }>()
const { t } = useI18n()
</script>

<template>
  <span v-if="apiKey.lastUsedAt" class="wrap-anywhere">
    <DateTime :value="apiKey.lastUsedAt" />
    <template v-if="apiKey.lastUsedFrom">
      {{ ` ${t('apiKeys.lastUsedFrom', { address: apiKey.lastUsedFrom })}` }}
    </template>
  </span>
  <span v-else>{{ t('apiKeys.neverUsed') }}</span>
</template>
