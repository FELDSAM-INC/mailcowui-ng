<script setup lang="ts">
// One key as a card, below the md breakpoint (FR-064): name, non-secret prefix, owner, access
// level, status, expiry and last use.
import { useId } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import type { ApiKey } from '@/api'
import { lt, text } from '@/i18n'
import DateTime from '@/shared/components/DateTime.vue'

import ApiKeyStatusBadge from './ApiKeyStatusBadge.vue'
import LastUse from './LastUse.vue'
import OwnerSummary from './OwnerSummary.vue'

defineProps<{ apiKey: ApiKey }>()
const { t } = useI18n()
const titleId = useId()
</script>

<template>
  <article :aria-labelledby="titleId" class="surface flex flex-col gap-3">
    <div class="flex flex-wrap items-start justify-between gap-2">
      <h2 :id="titleId" class="min-w-0 flex-1 font-semibold wrap-anywhere">
        <RouterLink
          :to="{ name: 'api-key-detail', params: { apiKeyId: apiKey.id } }"
          class="text-link"
          >{{ apiKey.name }}</RouterLink
        >
      </h2>
      <ApiKeyStatusBadge :status="apiKey.status" />
    </div>
    <dl class="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
      <dt class="font-medium text-gray-600 dark:text-gray-400">{{ t('apiKeys.fields.prefix') }}</dt>
      <dd class="font-mono wrap-anywhere text-gray-900 dark:text-white">{{ apiKey.prefix }}</dd>
      <dt class="font-medium text-gray-600 dark:text-gray-400">{{ lt('mailbox.owner') }}</dt>
      <dd><OwnerSummary :owner="apiKey.owner" /></dd>
      <dt class="font-medium text-gray-600 dark:text-gray-400">{{ t('apiKeys.fields.access') }}</dt>
      <dd class="text-gray-900 dark:text-white">
        {{ text(`enums.apiKeyAccessLevel.${apiKey.accessLevel}`) }}
      </dd>
      <dt class="font-medium text-gray-600 dark:text-gray-400">
        {{ t('apiKeys.fields.expires') }}
      </dt>
      <dd class="text-gray-900 dark:text-white">
        <DateTime v-if="apiKey.expiresAt" :value="apiKey.expiresAt" />
        <template v-else>{{ lt('user.expire_never') }}</template>
      </dd>
      <dt class="font-medium text-gray-600 dark:text-gray-400">
        {{ t('apiKeys.fields.lastUsed') }}
      </dt>
      <dd class="text-gray-900 dark:text-white"><LastUse :api-key="apiKey" /></dd>
    </dl>
  </article>
</template>
