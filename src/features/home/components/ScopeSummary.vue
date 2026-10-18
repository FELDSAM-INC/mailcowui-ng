<script setup lang="ts">
// What the signed-in account manages (FR-047): all domains for an administrator, the managed
// domains for a domain administrator (or a statement that none are assigned), the mailbox for a
// mailbox user.
import { useId } from 'vue'
import { useI18n } from 'vue-i18n'

import type { Identity } from '@/api'

defineProps<{ identity: Identity }>()
const { t } = useI18n()
const titleId = useId()
</script>

<template>
  <section data-scope class="surface" :aria-labelledby="titleId">
    <h2 :id="titleId" class="font-semibold text-gray-900 dark:text-white">
      {{ t('home.scope.heading') }}
    </h2>
    <div class="mt-2 text-gray-700 dark:text-gray-300">
      <p v-if="identity.scope.type === 'allDomains'">{{ t('home.scope.allDomains') }}</p>
      <template v-else-if="identity.scope.type === 'domains'">
        <template v-if="identity.scope.domains.length > 0">
          <p>{{ t('home.scope.domains') }}</p>
          <ul class="mt-1 list-disc ps-5">
            <li v-for="domain in identity.scope.domains" :key="domain" class="wrap-anywhere">
              {{ domain }}
            </li>
          </ul>
        </template>
        <p v-else>{{ t('home.scope.noDomains') }}</p>
      </template>
      <p v-else class="wrap-anywhere">
        {{ t('home.scope.mailbox', { mailbox: identity.scope.mailbox }) }}
      </p>
    </div>
  </section>
</template>
