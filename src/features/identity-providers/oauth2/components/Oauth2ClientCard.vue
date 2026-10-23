<script setup lang="ts">
import DataCard from '@/shared/components/DataCard.vue'
import DataCardFields from '@/shared/components/DataCardFields.vue'

// An OAuth2 client as a card below md (FR-055): the client ID as heading with a link to its page,
// then the classic columns ID and Redirect URI, and the actions. No secret (owner decision).
// Slots: `select` and `actions`.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { lt } from '@/i18n'
import type { Oauth2Client } from '@/api'

import RedirectUriList from './RedirectUriList.vue'

const props = defineProps<{ client: Oauth2Client }>()
const { t } = useI18n()
const id = computed(() => `oauth2-card-${props.client.id}`)
</script>

<template>
  <DataCard
    :data-entry="client.id"
    :title-id="`${id}-name`"
    :title="client.clientId"
    :to="{ name: 'oauth2-client-detail', params: { oauth2ClientId: client.id } }"
  >
    <template v-if="$slots.select" #select><slot name="select" /></template>
    <template v-if="$slots.actions" #actions><slot name="actions" /></template>
    <DataCardFields>
      <div class="flex gap-1">
        <dt class="text-gray-600 dark:text-gray-400">{{ t('oauth2.columns.id') }}:</dt>
        <dd class="text-gray-900 dark:text-white">{{ client.id }}</dd>
      </div>
      <div data-wide>
        <dt class="text-gray-600 dark:text-gray-400">{{ lt('admin.oauth2_redirect_uri') }}:</dt>
        <dd class="min-w-0 text-gray-900 dark:text-white">
          <RedirectUriList :uris="client.redirectUris" />
        </dd>
      </div>
    </DataCardFields>
  </DataCard>
</template>
