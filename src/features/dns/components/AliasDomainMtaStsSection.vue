<script setup lang="ts">
// The MTA-STS section of an alias domain page (FR-022; no classic counterpart): an alias domain has
// no policy of its own, it publishes its target domain's policy. The section says so and links to
// the target's MTA-STS section; it offers no editing.
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { lt } from '@/i18n'

defineProps<{ aliasDomain: string; targetDomain: string }>()
const { t } = useI18n()
</script>

<template>
  <section
    data-alias-mta-sts-section
    aria-labelledby="alias-mta-sts-title"
    class="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 dark:border-gray-800 dark:bg-gray-900"
  >
    <h2 id="alias-mta-sts-title" class="text-lg font-semibold text-gray-900 dark:text-white">
      {{ lt('edit.mta_sts') }}
    </h2>
    <p class="mt-3 text-sm break-words text-gray-800 dark:text-gray-200">
      {{ t('dns.mtaSts.alias.body', { aliasDomain, targetDomain }) }}
    </p>
    <RouterLink
      :to="{ name: 'domain-detail', params: { domain: targetDomain }, hash: '#mta-sts' }"
      class="mt-2 inline-flex min-h-11 items-center break-all text-accent-text bg-white dark:bg-gray-900 underline underline-offset-2"
    >
      {{ t('dns.mtaSts.alias.link', { targetDomain }) }}
    </RouterLink>
  </section>
</template>
