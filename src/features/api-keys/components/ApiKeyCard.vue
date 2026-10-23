<script setup lang="ts">
import DataCard from '@/shared/components/DataCard.vue'
import DataCardFields from '@/shared/components/DataCardFields.vue'
import RowAction from '@/shared/components/RowAction.vue'

// One key as a card, below the md breakpoint (FR-064): name, non-secret prefix, owner, access
// level, status, expiry and last use.
import { useId } from 'vue'
import { useI18n } from 'vue-i18n'

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
  <DataCard
    as="article"
    :data-entry="apiKey.id"
    :title-id="titleId"
    :title="apiKey.name"
    :to="{ name: 'api-key-detail', params: { apiKeyId: apiKey.id } }"
  >
    <template #badges><ApiKeyStatusBadge :status="apiKey.status" /></template>
    <template #actions>
      <RowAction
        :menu="false"
        :label="`${lt('mailbox.edit')}: ${apiKey.name}`"
        :to="{ name: 'api-key-detail', params: { apiKeyId: apiKey.id } }"
      >
        {{ lt('mailbox.edit') }}
      </RowAction>
    </template>
    <DataCardFields>
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
    </DataCardFields>
  </DataCard>
</template>
