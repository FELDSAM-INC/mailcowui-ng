<script setup lang="ts">
// An OAuth2 client as a card below md (FR-055): the client ID as heading with a link to its page,
// then the classic columns ID and Redirect URI, and the actions. No secret (owner decision).
// Slots: `select` and `actions`.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { lt } from '@/i18n'
import type { Oauth2Client } from '@/api'

import RedirectUriList from './RedirectUriList.vue'

const props = defineProps<{ client: Oauth2Client }>()
const { t } = useI18n()
const id = computed(() => `oauth2-card-${props.client.id}`)
</script>

<template>
  <li
    :data-entry="client.id"
    class="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
  >
    <article :aria-labelledby="`${id}-name`" class="flex flex-col gap-3">
      <div class="flex items-start gap-3">
        <slot name="select" />
        <!-- eslint-disable-next-line vuejs-accessibility/heading-has-content -- the link is its content -->
        <h3
          :id="`${id}-name`"
          class="min-w-0 flex-1 text-base font-semibold text-gray-900 dark:text-white"
        >
          <RouterLink
            :to="{ name: 'oauth2-client-detail', params: { oauth2ClientId: client.id } }"
            class="inline-flex min-h-11 items-center font-mono break-all underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500"
          >
            {{ client.clientId }}
          </RouterLink>
        </h3>
      </div>
      <dl class="grid grid-cols-1 gap-y-1 text-sm">
        <div class="flex gap-1">
          <dt class="text-gray-600 dark:text-gray-400">{{ t('oauth2.columns.id') }}:</dt>
          <dd class="text-gray-900 dark:text-white">{{ client.id }}</dd>
        </div>
        <div class="flex min-w-0 flex-col gap-0.5">
          <dt class="text-gray-600 dark:text-gray-400">{{ lt('admin.oauth2_redirect_uri') }}:</dt>
          <dd class="min-w-0 text-gray-900 dark:text-white">
            <RedirectUriList :uris="client.redirectUris" />
          </dd>
        </div>
      </dl>
      <slot name="actions" />
    </article>
  </li>
</template>
